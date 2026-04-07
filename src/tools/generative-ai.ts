import { z } from "zod";
import { readFile, access } from "fs/promises";
import { extname, resolve, normalize } from "path";
import { vertexRequest } from "../client.js";

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
    description: "Generate images from a text prompt using Imagen. Returns base64-encoded images. If unsure which model to use, call vertex_list_publisher_models first to discover available Imagen models.",
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
    }),
    handler: async (args: { model: string; prompt: string; sampleCount?: number; aspectRatio?: string; addWatermark?: boolean; enhancePrompt?: boolean; seed?: number; safetySetting?: string; personGeneration?: string }) => {
      const parameters: Record<string, unknown> = {};
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.aspectRatio !== undefined) parameters.aspectRatio = args.aspectRatio;
      if (args.addWatermark !== undefined) parameters.addWatermark = args.addWatermark;
      if (args.enhancePrompt !== undefined) parameters.enhancePrompt = args.enhancePrompt;
      if (args.seed !== undefined) parameters.seed = args.seed;
      if (args.safetySetting !== undefined) parameters.safetySetting = args.safetySetting;
      if (args.personGeneration !== undefined) parameters.personGeneration = args.personGeneration;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [{ prompt: args.prompt }],
        parameters,
      });
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
    }),
    handler: async (args: {
      model: string; prompt: string; imagePath?: string; imageBase64?: string;
      editMode?: string; maskPath?: string; maskBase64?: string; maskMode?: string;
      maskDilation?: number; maskClasses?: number[];
      stylePath?: string; styleBase64?: string;
      subjectPath?: string; subjectBase64?: string;
      baseSteps?: number; sampleCount?: number; safetySetting?: string;
    }) => {
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
        return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
          instances: [{ prompt: args.prompt, referenceImages }],
          parameters,
        });
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
        return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
          instances: [instance],
          parameters,
        });
      }
    },
  },
  {
    name: "vertex_upscale_image",
    description: "Upscale an image to higher resolution using Imagen. Accepts either a file path or base64 data.",
    inputSchema: z.object({
      model: z.string().describe("Imagen model for upscaling. Call vertex_list_publisher_models to discover available models."),
      imagePath: z.string().optional().describe("Local file path to the image to upscale. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded image to upscale. Use this OR imagePath."),
      upscaleFactor: z.string().optional().describe("Upscale factor: x2 or x4"),
      sampleCount: z.number().optional().describe("Number of upscaled variants (1-4)"),
    }),
    handler: async (args: { model: string; imagePath?: string; imageBase64?: string; upscaleFactor?: string; sampleCount?: number }) => {
      const imageData = await resolveBase64(args.imageBase64, args.imagePath);
      const parameters: Record<string, unknown> = { mode: "upscale" };
      if (args.upscaleFactor !== undefined) parameters.upscaleFactor = args.upscaleFactor;
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [{ image: { bytesBase64Encoded: imageData } }],
        parameters,
      });
    },
  },

  // ─── Gemini: Text Generation ────────────────────────────────────
  {
    name: "vertex_generate_content",
    description: "Generate text content using Gemini models via Vertex AI. Supports text, multimodal (image+text), and structured output. For multimodal input, use filePaths to attach local files (images, PDFs, audio, video) — they are automatically read and converted. If unsure which model to use, call vertex_list_publisher_models first.",
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
    }),
    handler: async (args: { model: string; prompt?: string; filePaths?: string[]; contents?: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number; topP?: number; topK?: number; responseMimeType?: string; stopSequences?: string[] }) => {
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
      if (Object.keys(generationConfig).length > 0) {
        body.generationConfig = generationConfig;
      }
      return vertexRequest("POST", `/publishers/google/models/${args.model}:generateContent`, body);
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
    }),
    handler: async (args: { model: string; prompt?: string; filePaths?: string[]; contents?: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number }) => {
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
      return vertexRequest("POST", `/publishers/google/models/${args.model}:streamGenerateContent`, body);
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
      return vertexRequest("POST", `/publishers/google/models/${args.model}:countTokens`, { contents });
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
      });
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
      });
    },
  },

  // ─── Veo: Video Generation ───────────────────────────────────────
  {
    name: "vertex_generate_video",
    description: "Generate a video from a text prompt using Veo models. Optionally provide an image as the first frame (image-to-video). Accepts file path for the image. Returns a long-running operation — use vertex_get_operation to poll for completion.",
    inputSchema: z.object({
      model: z.string().describe("Veo model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the video to generate"),
      imagePath: z.string().optional().describe("Local file path to an image to use as the first frame. Use this OR imageBase64."),
      imageBase64: z.string().optional().describe("Base64-encoded image for the first frame. Use this OR imagePath."),
      imageMimeType: z.string().optional().describe("MIME type of the input image (auto-detected from file path if imagePath is used)"),
      aspectRatio: z.string().optional().describe("Aspect ratio: 16:9 or 9:16 (default 16:9)"),
      durationSeconds: z.number().optional().describe("Video duration in seconds (5 or 8, default 5)"),
      sampleCount: z.number().optional().describe("Number of videos to generate (1-4)"),
      seed: z.number().optional().describe("Seed for deterministic output"),
      storageUri: z.string().optional().describe("GCS URI where generated video will be stored (e.g. gs://bucket/output/)"),
    }),
    handler: async (args: { model: string; prompt: string; imagePath?: string; imageBase64?: string; imageMimeType?: string; aspectRatio?: string; durationSeconds?: number; sampleCount?: number; seed?: number; storageUri?: string }) => {
      const instance: Record<string, unknown> = { prompt: args.prompt };
      if (args.imageBase64 || args.imagePath) {
        const imageData = await resolveBase64(args.imageBase64, args.imagePath);
        const mimeType = args.imageMimeType || (args.imagePath ? getMimeType(args.imagePath) : "image/png");
        instance.image = { bytesBase64Encoded: imageData, mimeType };
      }
      const parameters: Record<string, unknown> = {};
      if (args.aspectRatio !== undefined) parameters.aspectRatio = args.aspectRatio;
      if (args.durationSeconds !== undefined) parameters.durationSeconds = args.durationSeconds;
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.seed !== undefined) parameters.seed = args.seed;
      if (args.storageUri !== undefined) parameters.storageUri = args.storageUri;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [instance],
        ...(Object.keys(parameters).length > 0 && { parameters }),
      });
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
