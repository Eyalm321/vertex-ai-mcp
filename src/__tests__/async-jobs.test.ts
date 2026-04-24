import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("Async generation jobs", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.GOOGLE_PROJECT_ID = "test-project";
    process.env.VERTEX_AI_MCP_RETURN_BASE64 = "true"; // skip disk writes in tests
    vi.resetModules();
    const jobStore = await import("../job-store.js");
    jobStore.__resetJobStore();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  function mockAuthAndFetch(response: unknown, delayMs = 0) {
    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: vi.fn().mockResolvedValue(response),
              }),
            delayMs,
          ),
        ),
    );
    vi.stubGlobal("fetch", mockFetch);
    return mockFetch;
  }

  it("vertex_generate_content async:true returns jobId immediately", async () => {
    mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
    }, 100);

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content");

    const start = Date.now();
    const result = await tool!.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate",
      async: true,
    } as never) as { jobId: string; status: string; pollWith: string };
    const elapsed = Date.now() - start;

    expect(result.jobId).toMatch(/^[a-f0-9]{32}$/);
    expect(result.status).toBe("pending");
    expect(result.pollWith).toBe("vertex_get_job");
    expect(elapsed).toBeLessThan(50); // should return immediately, well before the 100ms fetch delay
    expect((result as unknown as { submittedAt: string }).submittedAt).toMatch(/T/); // ISO string
  });

  it("vertex_get_job returns pending then completed", async () => {
    mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "done" }] }, finishReason: "STOP" }],
    }, 80);

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const genTool = generativeAiTools.find((t) => t.name === "vertex_generate_content")!;
    const fetchTool = generativeAiTools.find((t) => t.name === "vertex_get_job")!;

    const { jobId } = (await genTool.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate",
      async: true,
    } as never)) as { jobId: string };

    // Shortly after submission: status should be running or pending (task is fetching)
    await new Promise((r) => setTimeout(r, 10));
    const midflight = await fetchTool.handler({ jobId } as never) as { status: string };
    expect(["pending", "running"]).toContain(midflight.status);

    // Wait for background task to finish
    await new Promise((r) => setTimeout(r, 150));
    const completed = await fetchTool.handler({ jobId } as never) as { status: string; result: Record<string, unknown> };
    expect(completed.status).toBe("completed");
    expect(completed.result).toBeDefined();
    expect(completed.result.candidates).toBeDefined();
  });

  it("vertex_get_job returns failed when generation errors", async () => {
    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("internal error"),
      }),
    );

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const genTool = generativeAiTools.find((t) => t.name === "vertex_generate_content")!;
    const fetchTool = generativeAiTools.find((t) => t.name === "vertex_get_job")!;

    const { jobId } = (await genTool.handler({
      model: "gemini-3-pro-image-preview",
      prompt: "generate",
      async: true,
    } as never)) as { jobId: string };

    await new Promise((r) => setTimeout(r, 50));
    const failed = await fetchTool.handler({ jobId } as never) as { status: string; error: { code: string; message: string } };
    expect(failed.status).toBe("failed");
    expect(failed.error.code).toBe("API_ERROR");
    expect(failed.error.message).toContain("500");
  });

  it("vertex_get_job throws on unknown jobId", async () => {
    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const fetchTool = generativeAiTools.find((t) => t.name === "vertex_get_job")!;

    await expect(fetchTool.handler({ jobId: "does-not-exist" } as never)).rejects.toThrow(
      /Job not found/,
    );
  });

  it("vertex_generate_image async:true works the same way", async () => {
    mockAuthAndFetch({
      predictions: [{ bytesBase64Encoded: PNG_1X1_BASE64, mimeType: "image/png" }],
    }, 50);

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const genTool = generativeAiTools.find((t) => t.name === "vertex_generate_image")!;
    const fetchTool = generativeAiTools.find((t) => t.name === "vertex_get_job")!;

    const { jobId } = (await genTool.handler({
      model: "imagen-4.0-ultra-generate-001",
      prompt: "a cat",
      async: true,
    } as never)) as { jobId: string };

    expect(jobId).toBeDefined();
    await new Promise((r) => setTimeout(r, 100));
    const completed = await fetchTool.handler({ jobId } as never) as { status: string; result: Record<string, unknown> };
    expect(completed.status).toBe("completed");
    expect(completed.result.predictions).toBeDefined();
  });

  it("vertex_list_jobs returns recent jobs with status filter", async () => {
    mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "ok" }] }, finishReason: "STOP" }],
    }, 20);

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const genTool = generativeAiTools.find((t) => t.name === "vertex_generate_content")!;
    const listTool = generativeAiTools.find((t) => t.name === "vertex_list_jobs")!;

    await genTool.handler({ model: "gemini-3-pro-image-preview", prompt: "a", async: true } as never);
    await genTool.handler({ model: "gemini-3-pro-image-preview", prompt: "b", async: true } as never);
    await new Promise((r) => setTimeout(r, 100));

    const listed = await listTool.handler({} as never) as { jobs: Array<Record<string, unknown>>; count: number };
    expect(listed.count).toBeGreaterThanOrEqual(2);
    expect(listed.jobs[0].jobId).toBeDefined();
    expect(listed.jobs[0].result).toBeUndefined(); // heavy field omitted in list view

    const completedOnly = await listTool.handler({ status: "completed" } as never) as { jobs: Array<Record<string, unknown>> };
    for (const j of completedOnly.jobs) expect(j.status).toBe("completed");
  });

  it("default (async undefined) behaves synchronously", async () => {
    mockAuthAndFetch({
      candidates: [{ content: { role: "model", parts: [{ text: "sync" }] }, finishReason: "STOP" }],
    });

    const { generativeAiTools } = await import("../tools/generative-ai.js");
    const tool = generativeAiTools.find((t) => t.name === "vertex_generate_content")!;

    const result = await tool.handler({
      model: "gemini-2.5-flash",
      prompt: "hi",
    } as never) as Record<string, unknown>;

    expect(result.candidates).toBeDefined();
    expect(result.jobId).toBeUndefined();
  });
});
