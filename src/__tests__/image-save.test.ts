import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, rm, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync } from "fs";

// Lightweight 1x1 PNG for test payloads
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("Image auto-save and model timeouts", () => {
  const originalEnv = process.env;
  let tempDir: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.GOOGLE_PROJECT_ID = "test-project";
    tempDir = await mkdtemp(join(tmpdir(), "vertex-mcp-test-"));
    process.env.VERTEX_AI_MCP_IMAGE_OUTPUT_DIR = tempDir;
    delete process.env.VERTEX_AI_MCP_RETURN_BASE64;
    vi.resetModules();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function mockAuthAndFetch(response: unknown) {
    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });
    vi.stubGlobal("fetch", mockFetch);
    return mockFetch;
  }

  it("vertex_generate_image auto-saves and strips base64 from Imagen response", async () => {
    mockAuthAndFetch({
      predictions: [
        { bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");
    expect(tool).toBeDefined();

    const result = await tool!.handler({
      model: "imagen-4.0-fast-generate-001",
      prompt: "a cat",
    } as never) as { predictions: Array<Record<string, unknown>> };

    expect(result.predictions).toHaveLength(1);
    const p = result.predictions[0];
    expect(p.bytesBase64Encoded).toBeUndefined();
    expect(p.filePath).toBeDefined();
    expect(p.mimeType).toBe("image/png");
    expect(p.size).toBeGreaterThan(0);
    expect(existsSync(p.filePath as string)).toBe(true);
    const bytes = await readFile(p.filePath as string);
    expect(bytes.length).toBe(p.size);
  });

  it("saves multiple images with incrementing indices when sampleCount > 1", async () => {
    mockAuthAndFetch({
      predictions: [
        { bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" },
        { bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    const result = await tool!.handler({
      model: "imagen-4.0-fast-generate-001",
      prompt: "a cat",
      sampleCount: 2,
    } as never) as { predictions: Array<Record<string, unknown>> };

    expect(result.predictions).toHaveLength(2);
    expect(result.predictions[0].filePath).not.toBe(result.predictions[1].filePath);
    expect((result.predictions[0].filePath as string)).toMatch(/-0\.png$/);
    expect((result.predictions[1].filePath as string)).toMatch(/-1\.png$/);
  });

  it("vertex_generate_content strips inlineData.data and preserves text parts", async () => {
    mockAuthAndFetch({
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              { text: "Here is your image:" },
              { inlineData: { mimeType: "image/png", data: PNG_1X1_BASE64 } },
            ],
          },
          finishReason: "STOP",
        },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    const result = await tool!.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate an image",
    } as never) as { candidates: Array<Record<string, unknown>> };

    const parts = (result.candidates[0].content as Record<string, unknown>).parts as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(2);
    expect(parts[0].text).toBe("Here is your image:");
    const inline = parts[1].inlineData as Record<string, unknown>;
    expect(inline.data).toBeUndefined();
    expect(inline.filePath).toBeDefined();
    expect(inline.mimeType).toBe("image/png");
    expect(existsSync(inline.filePath as string)).toBe(true);
  });

  it("returns base64 when VERTEX_AI_MCP_RETURN_BASE64=true", async () => {
    process.env.VERTEX_AI_MCP_RETURN_BASE64 = "true";
    mockAuthAndFetch({
      predictions: [
        { bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    const result = await tool!.handler({
      model: "imagen-4.0-fast-generate-001",
      prompt: "a cat",
    } as never) as { predictions: Array<Record<string, unknown>> };

    expect(result.predictions[0].bytesBase64Encoded).toBe(PNG_1X1_BASE64);
    expect(result.predictions[0].filePath).toBeUndefined();
  });

  it("respects saveToPath when absolute", async () => {
    mockAuthAndFetch({
      predictions: [
        { bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" },
      ],
    });

    const customPath = join(tempDir, "my-custom-name.png");
    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    const result = await tool!.handler({
      model: "imagen-4.0-fast-generate-001",
      prompt: "a cat",
      saveToPath: customPath,
    } as never) as { predictions: Array<Record<string, unknown>> };

    expect(result.predictions[0].filePath).toBe(customPath);
    expect(existsSync(customPath)).toBe(true);
  });

  it("text-only Gemini response is untouched", async () => {
    mockAuthAndFetch({
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Hello" }] },
          finishReason: "STOP",
        },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    const result = await tool!.handler({
      model: "gemini-2.5-flash",
      prompt: "Say hello",
    } as never) as { candidates: Array<Record<string, unknown>> };

    const parts = (result.candidates[0].content as Record<string, unknown>).parts as Array<Record<string, unknown>>;
    expect(parts).toEqual([{ text: "Hello" }]);
  });

  it("vertex_generate_image passes sampleImageSize through for 2K", async () => {
    const mockFetch = mockAuthAndFetch({
      predictions: [{ bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    const result = await tool!.handler({
      model: "imagen-4.0-ultra-generate-001",
      prompt: "a cat",
      imageSize: "2K",
    } as never) as Record<string, unknown>;

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.parameters.sampleImageSize).toBe("2K");
    expect(result.warnings).toBeUndefined();
  });

  it("vertex_generate_image downgrades 4K to 2K on Imagen with warning", async () => {
    const mockFetch = mockAuthAndFetch({
      predictions: [{ bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    const result = await tool!.handler({
      model: "imagen-4.0-ultra-generate-001",
      prompt: "a cat",
      imageSize: "4K",
    } as never) as Record<string, unknown>;

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.parameters.sampleImageSize).toBe("2K");
    expect(result.warnings).toEqual([expect.stringContaining("4K not supported")]);
  });

  it("vertex_generate_content passes imageConfig.imageSize for Nano Banana Pro 4K", async () => {
    const mockFetch = mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    const result = await tool!.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate a 4K image",
      imageSize: "4K",
    } as never) as Record<string, unknown>;

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.generationConfig.imageConfig.imageSize).toBe("4K");
    expect(result.warnings).toBeUndefined();
  });

  it("vertex_generate_content drops imageSize on Gemini 2.5 Flash Image with warning", async () => {
    const mockFetch = mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    const result = await tool!.handler({
      model: "gemini-2.5-flash-image",
      prompt: "generate image",
      imageSize: "2K",
    } as never) as Record<string, unknown>;

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.generationConfig?.imageConfig).toBeUndefined();
    expect(result.warnings).toEqual([expect.stringContaining("2K not supported")]);
  });

  it("rejects invalid imageSize via zod schema", async () => {
    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image")!;
    const parsed = tool.inputSchema.safeParse({
      model: "imagen-4.0-generate-001",
      prompt: "a cat",
      imageSize: "HD",
    });
    expect(parsed.success).toBe(false);
  });

  it("omits imageSize fields when not provided", async () => {
    const mockFetch = mockAuthAndFetch({
      predictions: [{ bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_image");

    await tool!.handler({
      model: "imagen-4.0-generate-001",
      prompt: "a cat",
    } as never);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.parameters.sampleImageSize).toBeUndefined();
  });

  it("passes extended timeout for Nano Banana Pro", async () => {
    const mockFetch = mockAuthAndFetch({
      candidates: [
        { content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" },
      ],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    await tool!.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate image",
    } as never);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.signal).toBeDefined();
    // AbortSignal.timeout is an AbortSignal — we can't directly inspect the timeout value,
    // but we can verify signal was attached (i.e., timeout logic ran).
  });
});
