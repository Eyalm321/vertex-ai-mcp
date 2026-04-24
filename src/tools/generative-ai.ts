import { z } from "zod";
import { readFile, access, mkdir, stat } from "fs/promises";
import { extname, resolve, normalize, join, isAbsolute, dirname } from "path";
import { tmpdir } from "os";
import { vertexRequest, getProjectId, getLocation, getAccessToken } from "../client.js";
import { writeFile } from "fs/promises";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

const BLOCKED_PATHS = [
  "/.ssh", "\\.ssh",
  "/.gnupg", "\\.gnupg",
  "/.aws", "\\.aws",
  "/.config", "\\.config",
  "/etc/shadow", "/etc/passwd", "/etc/hosts",
  "/.env",
];

function validateFilePath(filePath: string): string {
  const resolved = resolve(filePath);
  const normalized = normalize(resolved).replace(/\\/g, "/").toLowerCase();

  for (const blocked of BLOCKED_PATHS) {
    if (normalized.includes(blocked.toLowerCase())) {
      throw new Error(`Access denied: reading from '${blocked}' paths is not allowed for security reasons`);
    }
  }

  const ext = extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension '${ext}'. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
  }

  return resolved;
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

async function readFileAsBase64(filePath: string): Promise<string> {
  const validated = validateFilePath(filePath);
  try {
    await access(validated);
  } catch {
    throw new Error(`File not found: ${validated}`);
  }
  const buffer = await readFile(validated);
  return buffer.toString("base64");
}

async function resolveBase64(base64?: string, filePath?: string): Promise<string> {
  if (base64) return base64;
  if (filePath) return readFileAsBase64(filePath);
  throw new Error("Either base64 data or a file path must be provided");
}

/** Preview models (e.g. gemini-3-pro-preview) are only available on the global endpoint */
function isPreviewModel(model: string): boolean {
  return model.includes("preview");
}

function modelEndpointOptions(model: string): { globalLocation?: boolean } | undefined {
  return isPreviewModel(model) ? { globalLocation: true } : undefined;
}

// ─── Model-aware timeouts ─────────────────────────────────────────
/** Pick a timeout (ms) based on model name and requested image size. */
function getTimeoutForModel(model: string, imageSize?: string): number {
  let base: number;
  if (model.startsWith("veo-")) base = 600_000; // 10 min
  else if (/gemini-3.*image/i.test(model)) base = 300_000; // Nano Banana Pro: 5 min
  else if (/gemini-.*flash-image/i.test(model)) base = 180_000; // Nano Banana Flash: 3 min
  else if (/gemini.*image/i.test(model)) base = 300_000; // Other Gemini image: 5 min
  else if (model.startsWith("imagen-")) {
    base = model.includes("ultra") ? 180_000 : 120_000; // Ultra: 3 min, others: 2 min
  } else {
    base = 60_000; // default text generation
  }
  // Higher resolutions take longer
  if (imageSize === "2K") base += 60_000;
  if (imageSize === "4K") base += 180_000; // +60 (2K) + 120 (4K over 2K)
  return base;
}

/**
 * Determine what to do with a requested imageSize for a Gemini model.
 * Returns the size to actually send (or null to drop the field) + optional warning.
 */
function resolveGeminiImageSize(model: string, requested?: "1K" | "2K" | "4K"): {
  imageSize: "1K" | "2K" | "4K" | null;
  warning?: string;
} {
  if (!requested) return { imageSize: null };
  // gemini-2.5-flash-image (original Nano Banana): no imageConfig.imageSize support, 1K only
  if (/gemini-2\.5-flash-image/i.test(model)) {
    if (requested === "1K") return { imageSize: null }; // 1K is native, don't send the field
    return {
      imageSize: null,
      warning: `Requested ${requested} not supported on ${model} (1K only); generated at native 1K.`,
    };
  }
  // gemini-3-pro-image-preview, gemini-3.1-flash-image-preview: full 1K/2K/4K support
  return { imageSize: requested };
}

/**
 * Determine what to do with a requested imageSize for an Imagen model.
 * Imagen 4 family (Standard/Fast/Ultra) caps at 2K — no 4K support.
 */
function resolveImagenImageSize(model: string, requested?: "1K" | "2K" | "4K"): {
  imageSize: "1K" | "2K" | null;
  warning?: string;
} {
  if (!requested) return { imageSize: null };
  if (requested === "4K") {
    return {
      imageSize: "2K",
      warning: `Requested 4K not supported on ${model} (Imagen 4 caps at 2K); downgraded to 2K.`,
    };
  }
  return { imageSize: requested };
}

// ─── Image output: MIME → extension ───────────────────────────────
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
};

function extForMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType.toLowerCase()] || ".bin";
}

/** Resolve the directory to write generated images into. */
async function resolveOutputDir(): Promise<{ dir: string; fallbackUsed: boolean; warning?: string }> {
  const configured = process.env.VERTEX_AI_MCP_IMAGE_OUTPUT_DIR;
  const candidates = [
    configured,
    process.env.CLAUDE_WORKSPACE_OUTPUTS,
    process.env.CLAUDE_WORKSPACE,
    process.cwd(),
  ].filter((p): p is string => !!p);

  for (const candidate of candidates) {
    try {
      await mkdir(candidate, { recursive: true });
      const s = await stat(candidate);
      if (s.isDirectory()) {
        return { dir: candidate, fallbackUsed: false };
      }
    } catch {
      // Try next candidate
    }
  }

  // Last resort: OS tempdir
  const fallback = tmpdir();
  return {
    dir: fallback,
    fallbackUsed: true,
    warning: `Could not write to any configured output directory; using tempdir: ${fallback}`,
  };
}

function shouldReturnBase64(): boolean {
  const v = process.env.VERTEX_AI_MCP_RETURN_BASE64;
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Save a base64 image buffer to disk. Returns { filePath, size }.
 * If saveToPath is provided:
 *   - absolute → used as-is
 *   - relative → resolved against the output dir
 *   - if it's a directory → append auto filename
 * Otherwise a filename of {toolName}-{timestamp}-{index}.{ext} is used in the output dir.
 */
async function saveImageBuffer(
  buffer: Buffer,
  mimeType: string,
  toolName: string,
  index: number,
  saveToPath?: string,
): Promise<{ filePath: string; size: number; warning?: string }> {
  const ext = extForMimeType(mimeType);
  const { dir, warning } = await resolveOutputDir();

  let targetPath: string;
  if (saveToPath) {
    targetPath = isAbsolute(saveToPath) ? saveToPath : join(dir, saveToPath);
    // If targetPath is a directory (exists and is dir), append auto filename
    try {
      const s = await stat(targetPath);
      if (s.isDirectory()) {
        const filename = `${toolName}-${Date.now()}-${index}${ext}`;
        targetPath = join(targetPath, filename);
      }
    } catch {
      // Doesn't exist — assume it's a full file path
    }
  } else {
    const filename = `${toolName}-${Date.now()}-${index}${ext}`;
    targetPath = join(dir, filename);
  }

  // Ensure parent exists
  await mkdir(dirname(targetPath), { recursive: true });

  try {
    await writeFile(targetPath, buffer);
  } catch (err) {
    // Fall back to tempdir
    const fallbackPath = join(tmpdir(), `${toolName}-${Date.now()}-${index}${ext}`);
    await writeFile(fallbackPath, buffer);
    return {
      filePath: fallbackPath,
      size: buffer.length,
      warning: `Could not write to ${targetPath} (${(err as Error).message}); saved to tempdir instead`,
    };
  }

  return { filePath: targetPath, size: buffer.length, warning };
}

/**
 * Post-process an Imagen predict response: replace predictions[].bytesBase64Encoded
 * with filePath + size. Returns the modified response.
 */
async function saveImagenImages(
  response: Record<string, unknown>,
  toolName: string,
  saveToPath?: string,
): Promise<Record<string, unknown>> {
  if (shouldReturnBase64()) return response;
  const predictions = response.predictions as Array<Record<string, unknown>> | undefined;
  if (!predictions) return response;

  const outPredictions: Array<Record<string, unknown>> = [];
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    const b64 = p.bytesBase64Encoded as string | undefined;
    const mime = (p.mimeType as string | undefined) || "image/png";
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      const saved = await saveImageBuffer(buf, mime, toolName, i, saveToPath);
      const { bytesBase64Encoded, ...rest } = p;
      outPredictions.push({
        ...rest,
        filePath: saved.filePath,
        mimeType: mime,
        size: saved.size,
        ...(saved.warning ? { warning: saved.warning } : {}),
      });
    } else {
      outPredictions.push(p);
    }
  }
  return { ...response, predictions: outPredictions };
}

/**
 * Post-process a Gemini generateContent response: replace candidates[].content.parts[].inlineData.data
 * with inlineData.filePath. Preserves text parts and all other fields.
 */
async function saveGeminiImages(
  response: Record<string, unknown>,
  toolName: string,
  saveToPath?: string,
): Promise<Record<string, unknown>> {
  if (shouldReturnBase64()) return response;
  const candidates = response.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates) return response;

  let imageIndex = 0;
  const outCandidates: Array<Record<string, unknown>> = [];
  for (const cand of candidates) {
    const content = cand.content as Record<string, unknown> | undefined;
    if (!content) {
      outCandidates.push(cand);
      continue;
    }
    const parts = content.parts as Array<Record<string, unknown>> | undefined;
    if (!parts) {
      outCandidates.push(cand);
      continue;
    }
    const outParts: Array<Record<string, unknown>> = [];
    for (const part of parts) {
      const inlineData = part.inlineData as Record<string, unknown> | undefined;
      const b64 = inlineData?.data as string | undefined;
      const mime = inlineData?.mimeType as string | undefined;
      if (b64 && mime && mime.startsWith("image/")) {
        const buf = Buffer.from(b64, "base64");
        const saved = await saveImageBuffer(buf, mime, toolName, imageIndex++, saveToPath);
        outParts.push({
          inlineData: {
            filePath: saved.filePath,
            mimeType: mime,
            size: saved.size,
            ...(saved.warning ? { warning: saved.warning } : {}),
          },
        });
      } else {
        outParts.push(part);
      }
    }
    outCandidates.push({ ...cand, content: { ...content, parts: outParts } });
  }
  return { ...response, candidates: outCandidates };
}

export const generativeAiTools = [
  // ─── Model Discovery ───────────────────────────────────────────
  {
    name: "vertex_list_publisher_models",
    description: "List all available Google publisher models from the live API — includes Gemini, Imagen, Veo, embeddings, TTS, and more. Returns real-time model names and stages (GA/Preview/Experimental). Call this first if unsure which model ID to use for any tool.",
    inputSchema: z.object({
      pageSize: z.number().optional().describe("Maximum number of models to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { pageSize?: number; pageToken?: string }) => {
      const raw = await vertexRequest<{ publisherModels?: Array<{ name?: string; launchStage?: string }>; nextPageToken?: string }>("GET", "/publishers/google/models", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      }, { apiVersion: "v1beta1", noProjectPath: true });
      return {
        models: (raw.publisherModels || []).map((m) => ({
          id: (m.name || "").replace("publishers/google/models/", ""),
          stage: m.launchStage || "unknown",
        })),
        nextPageToken: raw.nextPageToken,
      };
    },
  },
  {
    name: "vertex_get_publisher_model",
    description: "Get live details of a specific Google publisher model including supported features, versions, and stage. Works for Gemini, Imagen, Veo, embedding models, etc.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID (e.g. gemini-2-5-pro, imagen-3-generate-002, veo-2-generate-001, text-embedding-005)"),
    }),
    handler: async (args: { modelId: string }) => {
      const raw = await vertexRequest<{ name?: string; versionId?: string; launchStage?: string; openSourceCategory?: string; publisherModelTemplate?: string }>("GET", `/publishers/google/models/${args.modelId}`, undefined, undefined, { apiVersion: "v1beta1", noProjectPath: true });
      return {
        id: (raw.name || "").replace("publishers/google/models/", ""),
        versionId: raw.versionId,
        stage: raw.launchStage || "unknown",
        openSourceCategory: raw.openSourceCategory,
        template: raw.publisherModelTemplate,
      };
    },
  },

  // ─── Imagen: Image Generation ───────────────────────────────────
  {
    name: "vertex_generate_image",
    description: "Generate images from a text prompt using Imagen. Images are saved to disk and file paths returned (set VERTEX_AI_MCP_RETURN_BASE64=true to return raw base64 instead). If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Imagen model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the image to generate"),
      sampleCount: z.number().optional().describe("Number of images to generate (1-4, default 1)"),
      aspectRatio: z.string().optional().describe("Aspect ratio: 1:1, 3:4, 4:3, 9:16, 16:9 (default 1:1)"),
      addWatermark: z.boolean().optional().describe("Add digital watermark (default true)"),
      enhancePrompt: z.boolean().optional().describe("Use LLM-based prompt rewriting for better results"),
      seed: z.number().optional().describe("Seed for deterministic output (requires addWatermark: false)"),
      safetySetting: z.string().optional().describe("Safety filter: block_low_and_above, block_medium_and_above, block_only_high, block_none"),
      personGeneration: z.string().optional().describe("People generation: allow_all, allow_adult, dont_allow"),
      imageSize: z.enum(["1K", "2K", "4K"]).optional().describe("Output image resolution. 1K ~1024px long side (default). 2K ~2048px (Imagen 4). 4K ~4096px (Imagen 4 Ultra only). Omit for the model's default."),
      saveToPath: z.string().optional().describe("Specific path to save the image. Absolute paths used as-is; relative paths resolved against the output dir. If a directory, auto-filename is appended."),
      timeout: z.number().optional().describe("Request timeout in seconds. Defaults to a model-aware value (120s for Imagen, 180s for Ultra; +60s for 2K, +180s for 4K)."),
    }),
    handler: async (args: { model: string; prompt: string; sampleCount?: number; aspectRatio?: string; addWatermark?: boolean; enhancePrompt?: boolean; seed?: number; safetySetting?: string; personGeneration?: string; imageSize?: "1K" | "2K" | "4K"; saveToPath?: string; timeout?: number }) => {
      const parameters: Record<string, unknown> = {};
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.aspectRatio !== undefined) parameters.aspectRatio = args.aspectRatio;
      if (args.addWatermark !== undefined) parameters.addWatermark = args.addWatermark;
      if (args.enhancePrompt !== undefined) parameters.enhancePrompt = args.enhancePrompt;
      if (args.seed !== undefined) parameters.seed = args.seed;
      if (args.safetySetting !== undefined) parameters.safetySetting = args.safetySetting;
      if (args.personGeneration !== undefined) parameters.personGeneration = args.personGeneration;
      const warnings: string[] = [];
      const sizeResolved = resolveImagenImageSize(args.model, args.imageSize);
      if (sizeResolved.imageSize) parameters.sampleImageSize = sizeResolved.imageSize;
      if (sizeResolved.warning) warnings.push(sizeResolved.warning);
      const effectiveSize = sizeResolved.imageSize ?? undefined;
      const timeoutMs = args.timeout ? args.timeout * 1000 : getTimeoutForModel(args.model, effectiveSize);
      const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [{ prompt: args.prompt }],
        parameters,
      }, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
      const saved = await saveImagenImages(response, "vertex_generate_image", args.saveToPath);
      return warnings.length > 0 ? { ...saved, warnings } : saved;
    },
  },
  {
    name: "vertex_edit_image",
    description: "Edit an existing image using Imagen with a text prompt. Supports mask-free editing (EDIT_MODE_DEFAULT), inpainting (EDIT_MODE_INPAINT_INSERTION/REMOVAL), background swap (EDIT_MODE_BGSWAP), outpainting (EDIT_MODE_OUTPAINT), style transfer (EDIT_MODE_STYLE), and more. For imagen-3.0-capability-001, uses the referenceImages API format. For older models (imagegeneration@006), uses the legacy image field format. Accepts file paths or base64 data.",
    inputSchema: z.object({
      model: z.string().describe("Imagen model for editing (e.g. imagen-3.0-capability-001). Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the desired edit"),
      imagePath: z.string().optional().describe("Local file path to the source image. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded source image. Use this OR imagePath."),
      editMode: z.string().optional().describe("Edit mode: EDIT_MODE_DEFAULT (mask-free), EDIT_MODE_INPAINT_INSERTION, EDIT_MODE_INPAINT_REMOVAL, EDIT_MODE_OUTPAINT, EDIT_MODE_BGSWAP, EDIT_MODE_STYLE, EDIT_MODE_CONTROLLED_EDITING, EDIT_MODE_PRODUCT_IMAGE. Default: EDIT_MODE_DEFAULT."),
      maskPath: z.string().optional().describe("Local file path to the mask image (for inpaint/outpaint modes). Use this OR maskBase64."),
      maskBase64: z.string().optional().describe("Base64-encoded mask image. Use this OR maskPath."),
      maskMode: z.string().optional().describe("Mask mode: MASK_MODE_USER_PROVIDED, MASK_MODE_BACKGROUND, MASK_MODE_FOREGROUND, MASK_MODE_SEMANTIC. Only for inpaint/outpaint modes."),
      maskDilation: z.number().optional().describe("Mask dilation factor (0.0-1.0). Expands mask edges."),
      maskClasses: z.array(z.number()).optional().describe("Semantic segmentation class IDs (for MASK_MODE_SEMANTIC)"),
      stylePath: z.string().optional().describe("Local file path to a style reference image. Use this OR styleBase64."),
      styleBase64: z.string().optional().describe("Base64-encoded style reference image. Use this OR stylePath."),
      subjectPath: z.string().optional().describe("Local file path to a subject reference image. Use this OR subjectBase64."),
      subjectBase64: z.string().optional().describe("Base64-encoded subject reference image. Use this OR subjectPath."),
      baseSteps: z.number().optional().describe("Number of diffusion steps (higher = better quality but slower, default 35)"),
      sampleCount: z.number().optional().describe("Number of edited images to generate (1-4)"),
      safetySetting: z.string().optional().describe("Safety filter threshold"),
      saveToPath: z.string().optional().describe("Specific path to save the edited image. Absolute paths used as-is; relative paths resolved against output dir."),
      timeout: z.number().optional().describe("Request timeout in seconds. Defaults to a model-aware value."),
    }),
    handler: async (args: {
      model: string; prompt: string; imagePath?: string; imageBase64?: string;
      editMode?: string; maskPath?: string; maskBase64?: string; maskMode?: string;
      maskDilation?: number; maskClasses?: number[];
      stylePath?: string; styleBase64?: string;
      subjectPath?: string; subjectBase64?: string;
      baseSteps?: number; sampleCount?: number; safetySetting?: string;
      saveToPath?: string; timeout?: number;
    }) => {
      const timeoutMs = args.timeout ? args.timeout * 1000 : getTimeoutForModel(args.model);
      const imageData = await resolveBase64(args.imageBase64, args.imagePath);
      const isCapabilityModel = args.model.includes("capability");

      if (isCapabilityModel) {
        // Imagen 3 capability model uses referenceImages format
        const referenceImages: Record<string, unknown>[] = [
          {
            referenceType: "REFERENCE_TYPE_RAW",
            referenceId: 1,
            referenceImage: { bytesBase64Encoded: imageData },
          },
        ];
        let refId = 2;
        if (args.maskBase64 || args.maskPath) {
          const maskData = await resolveBase64(args.maskBase64, args.maskPath);
          const maskRef: Record<string, unknown> = {
            referenceType: "REFERENCE_TYPE_MASK",
            referenceId: refId++,
            referenceImage: { bytesBase64Encoded: maskData },
          };
          const maskConfig: Record<string, unknown> = {};
          if (args.maskMode) maskConfig.maskMode = args.maskMode;
          else maskConfig.maskMode = "MASK_MODE_USER_PROVIDED";
          if (args.maskDilation !== undefined) maskConfig.dilation = args.maskDilation;
          if (args.maskClasses) maskConfig.maskClasses = args.maskClasses;
          maskRef.maskImageConfig = maskConfig;
          referenceImages.push(maskRef);
        }
        if (args.styleBase64 || args.stylePath) {
          const styleData = await resolveBase64(args.styleBase64, args.stylePath);
          referenceImages.push({
            referenceType: "REFERENCE_TYPE_STYLE",
            referenceId: refId++,
            referenceImage: { bytesBase64Encoded: styleData },
          });
        }
        if (args.subjectBase64 || args.subjectPath) {
          const subjectData = await resolveBase64(args.subjectBase64, args.subjectPath);
          referenceImages.push({
            referenceType: "REFERENCE_TYPE_SUBJECT",
            referenceId: refId++,
            referenceImage: { bytesBase64Encoded: subjectData },
          });
        }
        const parameters: Record<string, unknown> = {
          editMode: args.editMode || "EDIT_MODE_DEFAULT",
        };
        if (args.baseSteps !== undefined || !args.baseSteps) {
          parameters.editConfig = { baseSteps: args.baseSteps || 35 };
        }
        if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
        if (args.safetySetting !== undefined) parameters.safetySetting = args.safetySetting;
        const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:predict`, {
          instances: [{ prompt: args.prompt, referenceImages }],
          parameters,
        }, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
        return saveImagenImages(response, "vertex_edit_image", args.saveToPath);
      } else {
        // Legacy format for older models (imagegeneration@006, etc.)
        const instance: Record<string, unknown> = {
          prompt: args.prompt,
          image: { bytesBase64Encoded: imageData },
        };
        if (args.maskBase64 || args.maskPath) {
          const maskData = await resolveBase64(args.maskBase64, args.maskPath);
          instance.mask = { bytesBase64Encoded: maskData };
        }
        const parameters: Record<string, unknown> = {};
        if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
        if (args.safetySetting !== undefined) parameters.safetySetting = args.safetySetting;
        const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:predict`, {
          instances: [instance],
          parameters,
        }, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
        return saveImagenImages(response, "vertex_edit_image", args.saveToPath);
      }
    },
  },
  {
    name: "vertex_upscale_image",
    description: "Upscale an image to higher resolution using Imagen. Accepts either a file path or base64 data. For newer models (imagen-4.0-upscale-preview), uses the upscaleConfig format.",
    inputSchema: z.object({
      model: z.string().describe("Imagen upscale model (e.g. imagen-4.0-upscale-preview). Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().optional().describe("Prompt describing the image (required for newer upscale models, e.g. 'Upscale the image')"),
      imagePath: z.string().optional().describe("Local file path to the image to upscale. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded image to upscale. Use this OR imagePath."),
      upscaleFactor: z.string().optional().describe("Upscale factor: x2 or x4"),
      sampleCount: z.number().optional().describe("Number of upscaled variants (1-4)"),
      outputMimeType: z.string().optional().describe("Output MIME type: image/png or image/jpeg"),
      compressionQuality: z.number().optional().describe("JPEG compression quality (0-100, only for image/jpeg)"),
      storageUri: z.string().optional().describe("GCS URI to store the upscaled image (e.g. gs://bucket/output/)"),
      saveToPath: z.string().optional().describe("Specific path to save the upscaled image. Absolute paths used as-is; relative paths resolved against output dir."),
      timeout: z.number().optional().describe("Request timeout in seconds. Defaults to a model-aware value."),
    }),
    handler: async (args: { model: string; prompt?: string; imagePath?: string; imageBase64?: string; upscaleFactor?: string; sampleCount?: number; outputMimeType?: string; compressionQuality?: number; storageUri?: string; saveToPath?: string; timeout?: number }) => {
      const imageData = await resolveBase64(args.imageBase64, args.imagePath);
      const instance: Record<string, unknown> = {
        image: { bytesBase64Encoded: imageData },
      };
      if (args.prompt) instance.prompt = args.prompt;
      const parameters: Record<string, unknown> = { mode: "upscale" };
      if (args.upscaleFactor !== undefined) {
        parameters.upscaleConfig = { upscaleFactor: args.upscaleFactor };
      }
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.storageUri !== undefined) parameters.storageUri = args.storageUri;
      if (args.outputMimeType || args.compressionQuality !== undefined) {
        const outputOptions: Record<string, unknown> = {};
        if (args.outputMimeType) outputOptions.mimeType = args.outputMimeType;
        if (args.compressionQuality !== undefined) outputOptions.compressionQuality = args.compressionQuality;
        parameters.outputOptions = outputOptions;
      }
      const timeoutMs = args.timeout ? args.timeout * 1000 : getTimeoutForModel(args.model);
      const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [instance],
        parameters,
      }, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
      return saveImagenImages(response, "vertex_upscale_image", args.saveToPath);
    },
  },

  // ─── Gemini: Text Generation ────────────────────────────────────
  {
    name: "vertex_generate_content",
    description: "Generate text or multimodal content using Gemini models via Vertex AI. Supports text, image generation (Nano Banana), and multimodal input. For input files, use filePaths to attach local files (images, PDFs, audio, video). For image-generating models (e.g. gemini-3-pro-image-preview), output images are auto-saved to disk and file paths returned (set VERTEX_AI_MCP_RETURN_BASE64=true to return raw base64). If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Gemini model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().optional().describe("Simple text prompt. Use this for text-only requests instead of building the full contents array."),
      filePaths: z.array(z.string()).optional().describe("Array of local file paths to attach (images, PDFs, audio, video). Files are read from disk and sent as inline data. Use with prompt for easy multimodal requests."),
      contents: z.array(z.record(z.string(), z.unknown())).optional().describe("Full contents array with role (user/model) and parts. Use for multi-turn conversations or advanced usage. If prompt/filePaths are provided, they are used instead."),
      systemInstruction: z.string().optional().describe("System instruction text to guide the model behavior"),
      temperature: z.number().optional().describe("Sampling temperature (0.0-2.0, default 1.0)"),
      maxOutputTokens: z.number().optional().describe("Maximum number of tokens to generate"),
      topP: z.number().optional().describe("Top-p nucleus sampling (0.0-1.0)"),
      topK: z.number().optional().describe("Top-k sampling"),
      responseMimeType: z.string().optional().describe("Response format: text/plain or application/json"),
      stopSequences: z.array(z.string()).optional().describe("Sequences that stop generation"),
      imageSize: z.enum(["1K", "2K", "4K"]).optional().describe("Output image resolution for image-generation models. gemini-3-pro-image-preview (Nano Banana Pro) and gemini-3.1-flash-image-preview (Nano Banana 2) support 1K/2K/4K natively. gemini-2.5-flash-image (original Nano Banana) only supports 1K — 2K/4K requests will warn and fall back. Omit for the model's default."),
      saveToPath: z.string().optional().describe("Specific path to save generated output images (only applies to image-generation models). Absolute paths used as-is; relative resolved against output dir."),
      timeout: z.number().optional().describe("Request timeout in seconds. Defaults to a model-aware value (60s text, 300s image gen; +60s for 2K)."),
    }),
    handler: async (args: { model: string; prompt?: string; filePaths?: string[]; contents?: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number; topP?: number; topK?: number; responseMimeType?: string; stopSequences?: string[]; imageSize?: "1K" | "2K" | "4K"; saveToPath?: string; timeout?: number }) => {
      let contents: Record<string, unknown>[];
      if (args.prompt || args.filePaths) {
        const parts: Record<string, unknown>[] = [];
        if (args.prompt) {
          parts.push({ text: args.prompt });
        }
        if (args.filePaths) {
          for (const fp of args.filePaths) {
            const data = await readFileAsBase64(fp);
            const mimeType = getMimeType(fp);
            parts.push({ inlineData: { mimeType, data } });
          }
        }
        contents = [{ role: "user", parts }];
      } else if (args.contents) {
        contents = args.contents;
      } else {
        throw new Error("Provide either prompt/filePaths or contents");
      }
      const body: Record<string, unknown> = { contents };
      if (args.systemInstruction) {
        body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
      }
      const generationConfig: Record<string, unknown> = {};
      if (args.temperature !== undefined) generationConfig.temperature = args.temperature;
      if (args.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = args.maxOutputTokens;
      if (args.topP !== undefined) generationConfig.topP = args.topP;
      if (args.topK !== undefined) generationConfig.topK = args.topK;
      if (args.responseMimeType !== undefined) generationConfig.responseMimeType = args.responseMimeType;
      if (args.stopSequences !== undefined) generationConfig.stopSequences = args.stopSequences;
      const warnings: string[] = [];
      const sizeResolved = resolveGeminiImageSize(args.model, args.imageSize);
      if (sizeResolved.imageSize) {
        generationConfig.imageConfig = { imageSize: sizeResolved.imageSize };
      }
      if (sizeResolved.warning) warnings.push(sizeResolved.warning);
      if (Object.keys(generationConfig).length > 0) {
        body.generationConfig = generationConfig;
      }
      const effectiveSize = sizeResolved.imageSize ?? undefined;
      const timeoutMs = args.timeout ? args.timeout * 1000 : getTimeoutForModel(args.model, effectiveSize);
      const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:generateContent`, body, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
      const saved = await saveGeminiImages(response, "vertex_generate_content", args.saveToPath);
      return warnings.length > 0 ? { ...saved, warnings } : saved;
    },
  },
  {
    name: "vertex_stream_generate_content",
    description: "Generate text content with streaming using Gemini models via Vertex AI. Supports file attachments via filePaths. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Gemini model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().optional().describe("Simple text prompt. Use this for text-only requests."),
      filePaths: z.array(z.string()).optional().describe("Array of local file paths to attach (images, PDFs, audio, video)."),
      contents: z.array(z.record(z.string(), z.unknown())).optional().describe("Full contents array. If prompt/filePaths are provided, they are used instead."),
      systemInstruction: z.string().optional().describe("System instruction text"),
      temperature: z.number().optional().describe("Sampling temperature (0.0-2.0)"),
      maxOutputTokens: z.number().optional().describe("Maximum tokens to generate"),
      saveToPath: z.string().optional().describe("Specific path to save generated output images (only applies to image-generation models)."),
      timeout: z.number().optional().describe("Request timeout in seconds. Defaults to a model-aware value."),
    }),
    handler: async (args: { model: string; prompt?: string; filePaths?: string[]; contents?: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number; saveToPath?: string; timeout?: number }) => {
      let contents: Record<string, unknown>[];
      if (args.prompt || args.filePaths) {
        const parts: Record<string, unknown>[] = [];
        if (args.prompt) parts.push({ text: args.prompt });
        if (args.filePaths) {
          for (const fp of args.filePaths) {
            const data = await readFileAsBase64(fp);
            const mimeType = getMimeType(fp);
            parts.push({ inlineData: { mimeType, data } });
          }
        }
        contents = [{ role: "user", parts }];
      } else if (args.contents) {
        contents = args.contents;
      } else {
        throw new Error("Provide either prompt/filePaths or contents");
      }
      const body: Record<string, unknown> = { contents };
      if (args.systemInstruction) {
        body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
      }
      const generationConfig: Record<string, unknown> = {};
      if (args.temperature !== undefined) generationConfig.temperature = args.temperature;
      if (args.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = args.maxOutputTokens;
      if (Object.keys(generationConfig).length > 0) {
        body.generationConfig = generationConfig;
      }
      const timeoutMs = args.timeout ? args.timeout * 1000 : getTimeoutForModel(args.model);
      const response = await vertexRequest<Record<string, unknown>>("POST", `/publishers/google/models/${args.model}:streamGenerateContent`, body, undefined, { ...modelEndpointOptions(args.model), timeoutMs });
      return saveGeminiImages(response, "vertex_stream_generate_content", args.saveToPath);
    },
  },
  {
    name: "vertex_count_tokens",
    description: "Count the number of tokens in a prompt before sending it to a Gemini model.",
    inputSchema: z.object({
      model: z.string().describe("Gemini model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().optional().describe("Simple text prompt to count tokens for."),
      filePaths: z.array(z.string()).optional().describe("Local file paths to include in token count."),
      contents: z.array(z.record(z.string(), z.unknown())).optional().describe("Full contents array to count tokens for."),
    }),
    handler: async (args: { model: string; prompt?: string; filePaths?: string[]; contents?: Record<string, unknown>[] }) => {
      let contents: Record<string, unknown>[];
      if (args.prompt || args.filePaths) {
        const parts: Record<string, unknown>[] = [];
        if (args.prompt) parts.push({ text: args.prompt });
        if (args.filePaths) {
          for (const fp of args.filePaths) {
            const data = await readFileAsBase64(fp);
            const mimeType = getMimeType(fp);
            parts.push({ inlineData: { mimeType, data } });
          }
        }
        contents = [{ role: "user", parts }];
      } else if (args.contents) {
        contents = args.contents;
      } else {
        throw new Error("Provide either prompt/filePaths or contents");
      }
      return vertexRequest("POST", `/publishers/google/models/${args.model}:countTokens`, { contents }, undefined, modelEndpointOptions(args.model));
    },
  },

  // ─── Embeddings ─────────────────────────────────────────────────
  {
    name: "vertex_embed_text",
    description: "Generate text embeddings using Vertex AI embedding models. Useful for semantic search, clustering, and classification. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Embedding model name. Call vertex_list_publisher_models to discover available models."),
      texts: z.array(z.string()).describe("Array of text strings to embed"),
      taskType: z.string().optional().describe("Task type: RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, SEMANTIC_SIMILARITY, CLASSIFICATION, CLUSTERING, QUESTION_ANSWERING, FACT_VERIFICATION"),
      title: z.string().optional().describe("Title for the document (used with RETRIEVAL_DOCUMENT task type)"),
      outputDimensionality: z.number().optional().describe("Desired embedding dimensionality (truncates if smaller than model default)"),
    }),
    handler: async (args: { model: string; texts: string[]; taskType?: string; title?: string; outputDimensionality?: number }) => {
      const instances = args.texts.map((text) => {
        const instance: Record<string, unknown> = { content: text };
        if (args.taskType) instance.taskType = args.taskType;
        if (args.title) instance.title = args.title;
        return instance;
      });
      const parameters: Record<string, unknown> = {};
      if (args.outputDimensionality !== undefined) parameters.outputDimensionality = args.outputDimensionality;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances,
        ...(Object.keys(parameters).length > 0 && { parameters }),
      }, undefined, modelEndpointOptions(args.model));
    },
  },
  {
    name: "vertex_embed_multimodal",
    description: "Generate multimodal embeddings from text, images, or video using Vertex AI. Useful for cross-modal search. Accepts file paths for images — no need to convert to base64 manually.",
    inputSchema: z.object({
      model: z.string().describe("Multimodal embedding model. Call vertex_list_publisher_models to discover available models."),
      text: z.string().optional().describe("Text to embed"),
      imagePath: z.string().optional().describe("Local file path to an image to embed. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded image to embed. Use this OR imagePath."),
      imageMimeType: z.string().optional().describe("Image MIME type (auto-detected from file path if imagePath is used)"),
      videoUri: z.string().optional().describe("GCS URI of video to embed (gs://bucket/video.mp4)"),
      dimension: z.number().optional().describe("Embedding dimension: 128, 256, 512, or 1408 (default 1408)"),
    }),
    handler: async (args: { model: string; text?: string; imagePath?: string; imageBase64?: string; imageMimeType?: string; videoUri?: string; dimension?: number }) => {
      const instance: Record<string, unknown> = {};
      if (args.text) instance.text = args.text;
      if (args.imageBase64 || args.imagePath) {
        const imageData = await resolveBase64(args.imageBase64, args.imagePath);
        const mimeType = args.imageMimeType || (args.imagePath ? getMimeType(args.imagePath) : "image/png");
        instance.image = { bytesBase64Encoded: imageData, mimeType };
      }
      if (args.videoUri) {
        instance.video = { gcsUri: args.videoUri };
      }
      const parameters: Record<string, unknown> = {};
      if (args.dimension !== undefined) parameters.dimension = args.dimension;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [instance],
        ...(Object.keys(parameters).length > 0 && { parameters }),
      }, undefined, modelEndpointOptions(args.model));
    },
  },

  // ─── Veo: Video Generation ───────────────────────────────────────
  {
    name: "vertex_generate_video",
    description: "Generate a video from a text prompt using Veo models. Optionally provide an image as the first frame (image-to-video). Accepts file path for the image. Returns a long-running operation — use vertex_get_operation to poll for completion. Requires storageUri (GCS bucket) for output.",
    inputSchema: z.object({
      model: z.string().describe("Veo model name (e.g. veo-3-generate-preview-001). Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the video to generate"),
      imagePath: z.string().optional().describe("Local file path to an image to use as the first frame. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded image for the first frame. Use this OR imagePath."),
      imageMimeType: z.string().optional().describe("MIME type of the input image (auto-detected from file path if imagePath is used)"),
      aspectRatio: z.string().optional().describe("Aspect ratio: 16:9 or 9:16 (default 16:9)"),
      durationSeconds: z.number().optional().describe("Video duration in seconds (4, 5, 6, or 8, default 5)"),
      sampleCount: z.number().optional().describe("Number of videos to generate (1-4)"),
      seed: z.number().optional().describe("Seed for deterministic output"),
      negativePrompt: z.string().optional().describe("What to avoid in the generated video"),
      enhancePrompt: z.boolean().optional().describe("Use LLM-based prompt rewriting for better results (Veo 2 only)"),
      personGeneration: z.string().optional().describe("People generation: allow_all, allow_adult, dont_allow"),
      generateAudio: z.boolean().optional().describe("Generate audio for the video (Veo 3+)"),
      storageUri: z.string().describe("GCS URI where generated video will be stored (e.g. gs://bucket/output/). Required."),
    }),
    handler: async (args: { model: string; prompt: string; imagePath?: string; imageBase64?: string; imageMimeType?: string; aspectRatio?: string; durationSeconds?: number; sampleCount?: number; seed?: number; negativePrompt?: string; enhancePrompt?: boolean; personGeneration?: string; generateAudio?: boolean; storageUri: string }) => {
      const instance: Record<string, unknown> = { prompt: args.prompt };
      if (args.imageBase64 || args.imagePath) {
        const imageData = await resolveBase64(args.imageBase64, args.imagePath);
        const mimeType = args.imageMimeType || (args.imagePath ? getMimeType(args.imagePath) : "image/png");
        instance.image = { bytesBase64Encoded: imageData, mimeType };
      }
      const parameters: Record<string, unknown> = {
        storageUri: args.storageUri,
      };
      if (args.aspectRatio !== undefined) parameters.aspectRatio = args.aspectRatio;
      if (args.durationSeconds !== undefined) parameters.durationSeconds = args.durationSeconds;
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.seed !== undefined) parameters.seed = args.seed;
      if (args.negativePrompt !== undefined) parameters.negativePrompt = args.negativePrompt;
      if (args.enhancePrompt !== undefined) parameters.enhancePrompt = args.enhancePrompt;
      if (args.personGeneration !== undefined) parameters.personGeneration = args.personGeneration;
      if (args.generateAudio !== undefined) parameters.generateAudio = args.generateAudio;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predictLongRunning`, {
        instances: [instance],
        parameters,
      }, undefined, modelEndpointOptions(args.model));
    },
  },

  // ─── Predict Operation Polling (Veo, Imagen, Lyria LROs) ────────
  {
    name: "vertex_fetch_predict_operation",
    description: "Poll the status of a long-running predict operation (Veo video generation, Imagen batch, Lyria music, etc.). Returns { done, result, error }. When done=true, result contains the final output (e.g. videos[].gcsUri for Veo). Use this to poll after vertex_generate_video returns an operation name.",
    inputSchema: z.object({
      operationName: z.string().describe("Full operation resource name from the predictLongRunning response (e.g. projects/.../locations/.../publishers/google/models/veo-3.1-generate-001/operations/UUID)"),
    }),
    handler: async (args: { operationName: string }) => {
      // Extract model resource path from the operation name
      // e.g. "projects/X/locations/Y/publishers/google/models/veo-3.1-generate-001/operations/UUID"
      // → model resource: "projects/X/locations/Y/publishers/google/models/veo-3.1-generate-001"
      const opParts = args.operationName.split("/operations/");
      if (opParts.length !== 2) {
        throw new Error(`Invalid operation name format. Expected: projects/.../publishers/google/models/{model}/operations/{uuid}`);
      }
      const modelResource = opParts[0];

      // Determine if this is a preview model that needs global endpoint
      const isPreview = modelResource.includes("preview");
      const location = getLocation();
      const projectId = getProjectId();

      let baseUrl: string;
      if (isPreview) {
        baseUrl = `https://aiplatform.googleapis.com/v1`;
      } else {
        baseUrl = `https://${location}-aiplatform.googleapis.com/v1`;
      }

      const url = `${baseUrl}/${modelResource}:fetchPredictOperation`;
      const token = await getAccessToken();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operationName: args.operationName }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Vertex AI API error ${res.status}: ${text}`);
      }

      const raw = await res.json() as Record<string, unknown>;

      // Normalize the response into a simple { done, result, error } shape
      const done = raw.done === true;
      const error = raw.error as Record<string, unknown> | undefined;
      const response = raw.response as Record<string, unknown> | undefined;

      if (error) {
        return { done: true, error: { code: error.code, message: error.message }, result: null };
      }

      if (done && response) {
        // Extract video URIs if present (Veo)
        const videos = (response as Record<string, unknown>).videos as Array<{ gcsUri?: string }> | undefined;
        if (videos) {
          return {
            done: true,
            error: null,
            result: {
              videos: videos.map((v) => ({ gcsUri: v.gcsUri })),
            },
          };
        }
        // Generic response for other model types
        return { done: true, error: null, result: response };
      }

      // Still running
      const metadata = raw.metadata as Record<string, unknown> | undefined;
      return {
        done: false,
        error: null,
        result: null,
        metadata: metadata ? { state: (metadata as Record<string, unknown>).state } : undefined,
      };
    },
  },

  // ─── GCS Object Fetch ──────────────────────────────────────────
  {
    name: "vertex_fetch_gcs_object",
    description: "Download an object from Google Cloud Storage using the MCP server's credentials. Useful for retrieving Veo-generated videos, batch prediction outputs, tuned model artifacts, or any private GCS object. Can return base64 data or save to a local file path.",
    inputSchema: z.object({
      gcsUri: z.string().describe("GCS URI of the object (e.g. gs://bucket-name/path/to/file.mp4)"),
      savePath: z.string().optional().describe("Local file path to save the downloaded object. If omitted, returns base64-encoded data."),
    }),
    handler: async (args: { gcsUri: string; savePath?: string }) => {
      // Parse gs://bucket/path
      const match = args.gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
      if (!match) {
        throw new Error(`Invalid GCS URI format. Expected gs://bucket/path, got: ${args.gcsUri}`);
      }
      const [, bucket, objectPath] = match;

      const token = await getAccessToken();
      const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GCS error ${res.status}: ${text}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      if (args.savePath) {
        // Validate save path extension
        const ext = extname(args.savePath).toLowerCase();
        if (!ext) {
          throw new Error("Save path must include a file extension");
        }
        await writeFile(args.savePath, buffer);
        return {
          saved: true,
          path: args.savePath,
          size: buffer.length,
          sizeHuman: buffer.length > 1048576
            ? `${(buffer.length / 1048576).toFixed(1)} MB`
            : `${(buffer.length / 1024).toFixed(1)} KB`,
        };
      } else {
        // Return base64 for small files, warn for large ones
        const base64 = buffer.toString("base64");
        const mimeType = getMimeType(args.gcsUri);
        return {
          mimeType,
          size: buffer.length,
          sizeHuman: buffer.length > 1048576
            ? `${(buffer.length / 1048576).toFixed(1)} MB`
            : `${(buffer.length / 1024).toFixed(1)} KB`,
          data: base64,
          warning: buffer.length > 5242880 ? "Large file (>5MB). Consider using savePath to write to disk instead." : undefined,
        };
      }
    },
  },

  // ─── Cached Content ─────────────────────────────────────────────
  {
    name: "vertex_create_cached_content",
    description: "Create cached content for Gemini to reuse across multiple requests, reducing latency and cost for large contexts.",
    inputSchema: z.object({
      model: z.string().describe("Full model resource path (e.g. publishers/google/models/gemini-2-0-flash)"),
      contents: z.array(z.record(z.string(), z.unknown())).describe("Content to cache"),
      systemInstruction: z.string().optional().describe("System instruction to cache"),
      ttl: z.string().optional().describe("Time-to-live duration (e.g. 3600s for 1 hour)"),
      displayName: z.string().optional().describe("Human-readable name for the cached content"),
    }),
    handler: async (args: { model: string; contents: Record<string, unknown>[]; systemInstruction?: string; ttl?: string; displayName?: string }) => {
      const body: Record<string, unknown> = {
        model: args.model,
        contents: args.contents,
      };
      if (args.systemInstruction) {
        body.systemInstruction = { parts: [{ text: args.systemInstruction }] };
      }
      if (args.ttl) body.ttl = args.ttl;
      if (args.displayName) body.displayName = args.displayName;
      return vertexRequest("POST", "/cachedContents", body);
    },
  },
  {
    name: "vertex_get_cached_content",
    description: "Get details of a cached content resource.",
    inputSchema: z.object({
      cachedContentId: z.string().describe("The cached content ID"),
    }),
    handler: async (args: { cachedContentId: string }) => {
      return vertexRequest("GET", `/cachedContents/${args.cachedContentId}`);
    },
  },
  {
    name: "vertex_list_cached_contents",
    description: "List all cached content resources in the project.",
    inputSchema: z.object({
      pageSize: z.number().optional().describe("Maximum number of items to return"),
      pageToken: z.string().optional().describe("Page token for pagination"),
    }),
    handler: async (args: { pageSize?: number; pageToken?: string }) => {
      return vertexRequest("GET", "/cachedContents", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      });
    },
  },
  {
    name: "vertex_update_cached_content",
    description: "Update a cached content's TTL or expiration time.",
    inputSchema: z.object({
      cachedContentId: z.string().describe("The cached content ID"),
      ttl: z.string().optional().describe("New time-to-live (e.g. 7200s)"),
      expireTime: z.string().optional().describe("New expiration timestamp (RFC 3339)"),
      updateMask: z.string().describe("Fields to update (e.g. ttl or expireTime)"),
    }),
    handler: async (args: { cachedContentId: string; ttl?: string; expireTime?: string; updateMask: string }) => {
      return vertexRequest("PATCH", `/cachedContents/${args.cachedContentId}`, {
        ...(args.ttl && { ttl: args.ttl }),
        ...(args.expireTime && { expireTime: args.expireTime }),
      }, { updateMask: args.updateMask });
    },
  },
  {
    name: "vertex_delete_cached_content",
    description: "Delete a cached content resource.",
    inputSchema: z.object({
      cachedContentId: z.string().describe("The cached content ID to delete"),
    }),
    handler: async (args: { cachedContentId: string }) => {
      return vertexRequest("DELETE", `/cachedContents/${args.cachedContentId}`);
    },
  },
];
