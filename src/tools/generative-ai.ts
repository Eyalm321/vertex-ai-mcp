import { z } from "zod";
import { vertexRequest } from "../client.js";

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
      return vertexRequest("GET", "/publishers/google/models", undefined, {
        pageSize: args.pageSize,
        pageToken: args.pageToken,
      }, { apiVersion: "v1beta1", noProjectPath: true });
    },
  },
  {
    name: "vertex_get_publisher_model",
    description: "Get live details of a specific Google publisher model including supported features, versions, and stage. Works for Gemini, Imagen, Veo, embedding models, etc.",
    inputSchema: z.object({
      modelId: z.string().describe("The model ID (e.g. gemini-2-5-pro, imagen-3-generate-002, veo-2-generate-001, text-embedding-005)"),
    }),
    handler: async (args: { modelId: string }) => {
      return vertexRequest("GET", `/publishers/google/models/${args.modelId}`, undefined, undefined, { apiVersion: "v1beta1", noProjectPath: true });
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
    description: "Edit an existing image using Imagen with a text prompt and optional mask for inpainting. Supports object insertion/removal, background replacement, and style transfer. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Imagen model for editing. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the desired edit"),
      imageBase64: z.string().describe("Base64-encoded source image to edit"),
      maskBase64: z.string().optional().describe("Base64-encoded mask image for inpainting (white=edit area, black=keep)"),
      sampleCount: z.number().optional().describe("Number of edited images to generate (1-4)"),
      safetySetting: z.string().optional().describe("Safety filter threshold"),
    }),
    handler: async (args: { model: string; prompt: string; imageBase64: string; maskBase64?: string; sampleCount?: number; safetySetting?: string }) => {
      const instance: Record<string, unknown> = {
        prompt: args.prompt,
        image: { bytesBase64Encoded: args.imageBase64 },
      };
      if (args.maskBase64) {
        instance.mask = { bytesBase64Encoded: args.maskBase64 };
      }
      const parameters: Record<string, unknown> = {};
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      if (args.safetySetting !== undefined) parameters.safetySetting = args.safetySetting;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [instance],
        parameters,
      });
    },
  },
  {
    name: "vertex_upscale_image",
    description: "Upscale an image to higher resolution using Imagen. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Imagen model for upscaling. Call vertex_list_publisher_models to discover available models."),
      imageBase64: z.string().describe("Base64-encoded image to upscale"),
      upscaleFactor: z.string().optional().describe("Upscale factor: x2 or x4"),
      sampleCount: z.number().optional().describe("Number of upscaled variants (1-4)"),
    }),
    handler: async (args: { model: string; imageBase64: string; upscaleFactor?: string; sampleCount?: number }) => {
      const parameters: Record<string, unknown> = { mode: "upscale" };
      if (args.upscaleFactor !== undefined) parameters.upscaleFactor = args.upscaleFactor;
      if (args.sampleCount !== undefined) parameters.sampleCount = args.sampleCount;
      return vertexRequest("POST", `/publishers/google/models/${args.model}:predict`, {
        instances: [{ image: { bytesBase64Encoded: args.imageBase64 } }],
        parameters,
      });
    },
  },

  // ─── Gemini: Text Generation ────────────────────────────────────
  {
    name: "vertex_generate_content",
    description: "Generate text content using Gemini models via Vertex AI. Supports text, multimodal (image+text), and structured output. If unsure which model to use, call vertex_list_publisher_models first to discover available Gemini models.",
    inputSchema: z.object({
      model: z.string().describe("Gemini model name. Call vertex_list_publisher_models to discover available models."),
      contents: z.array(z.record(z.string(), z.unknown())).describe("Array of content objects with role (user/model) and parts (array of {text} or {inlineData: {mimeType, data}})"),
      systemInstruction: z.string().optional().describe("System instruction text to guide the model behavior"),
      temperature: z.number().optional().describe("Sampling temperature (0.0-2.0, default 1.0)"),
      maxOutputTokens: z.number().optional().describe("Maximum number of tokens to generate"),
      topP: z.number().optional().describe("Top-p nucleus sampling (0.0-1.0)"),
      topK: z.number().optional().describe("Top-k sampling"),
      responseMimeType: z.string().optional().describe("Response format: text/plain or application/json"),
      stopSequences: z.array(z.string()).optional().describe("Sequences that stop generation"),
    }),
    handler: async (args: { model: string; contents: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number; topP?: number; topK?: number; responseMimeType?: string; stopSequences?: string[] }) => {
      const body: Record<string, unknown> = { contents: args.contents };
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
    description: "Generate text content with streaming using Gemini models via Vertex AI. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Gemini model name. Call vertex_list_publisher_models to discover available models."),
      contents: z.array(z.record(z.string(), z.unknown())).describe("Array of content objects with role and parts"),
      systemInstruction: z.string().optional().describe("System instruction text"),
      temperature: z.number().optional().describe("Sampling temperature (0.0-2.0)"),
      maxOutputTokens: z.number().optional().describe("Maximum tokens to generate"),
    }),
    handler: async (args: { model: string; contents: Record<string, unknown>[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number }) => {
      const body: Record<string, unknown> = { contents: args.contents };
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
      contents: z.array(z.record(z.string(), z.unknown())).describe("Array of content objects to count tokens for"),
    }),
    handler: async (args: { model: string; contents: Record<string, unknown>[] }) => {
      return vertexRequest("POST", `/publishers/google/models/${args.model}:countTokens`, {
        contents: args.contents,
      });
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
    description: "Generate multimodal embeddings from text, images, or video using Vertex AI. Useful for cross-modal search. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Multimodal embedding model. Call vertex_list_publisher_models to discover available models."),
      text: z.string().optional().describe("Text to embed"),
      imageBase64: z.string().optional().describe("Base64-encoded image to embed"),
      imageMimeType: z.string().optional().describe("Image MIME type (e.g. image/png, image/jpeg)"),
      videoUri: z.string().optional().describe("GCS URI of video to embed (gs://bucket/video.mp4)"),
      dimension: z.number().optional().describe("Embedding dimension: 128, 256, 512, or 1408 (default 1408)"),
    }),
    handler: async (args: { model: string; text?: string; imageBase64?: string; imageMimeType?: string; videoUri?: string; dimension?: number }) => {
      const instance: Record<string, unknown> = {};
      if (args.text) instance.text = args.text;
      if (args.imageBase64) {
        instance.image = { bytesBase64Encoded: args.imageBase64 };
        if (args.imageMimeType) (instance.image as Record<string, unknown>).mimeType = args.imageMimeType;
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
    description: "Generate a video from a text prompt using Veo models. Returns a long-running operation — use vertex_get_operation to poll for completion, then the result contains a GCS URI to the generated video. If unsure which model to use, call vertex_list_publisher_models first.",
    inputSchema: z.object({
      model: z.string().describe("Veo model name. Call vertex_list_publisher_models to discover available models."),
      prompt: z.string().describe("Text description of the video to generate"),
      imageBase64: z.string().optional().describe("Base64-encoded image to use as the first frame (image-to-video)"),
      imageMimeType: z.string().optional().describe("MIME type of the input image (e.g. image/png)"),
      aspectRatio: z.string().optional().describe("Aspect ratio: 16:9 or 9:16 (default 16:9)"),
      durationSeconds: z.number().optional().describe("Video duration in seconds (5 or 8, default 5)"),
      sampleCount: z.number().optional().describe("Number of videos to generate (1-4)"),
      seed: z.number().optional().describe("Seed for deterministic output"),
      storageUri: z.string().optional().describe("GCS URI where generated video will be stored (e.g. gs://bucket/output/)"),
    }),
    handler: async (args: { model: string; prompt: string; imageBase64?: string; imageMimeType?: string; aspectRatio?: string; durationSeconds?: number; sampleCount?: number; seed?: number; storageUri?: string }) => {
      const instance: Record<string, unknown> = { prompt: args.prompt };
      if (args.imageBase64) {
        instance.image = { bytesBase64Encoded: args.imageBase64, mimeType: args.imageMimeType || "image/png" };
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
