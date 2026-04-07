import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Vertex AI Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when GOOGLE_PROJECT_ID is not set", async () => {
    delete process.env.GOOGLE_PROJECT_ID;
    const { vertexRequest } = await import("../client.js");
    await expect(vertexRequest("GET", "/datasets")).rejects.toThrow(
      "GOOGLE_PROJECT_ID environment variable is not set"
    );
  });

  it("defaults GOOGLE_LOCATION to us-central1", async () => {
    process.env.GOOGLE_PROJECT_ID = "test-project";
    delete process.env.GOOGLE_LOCATION;

    // Mock google-auth-library
    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ datasets: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { vertexRequest } = await import("../client.js");
    await vertexRequest("GET", "/datasets");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("us-central1-aiplatform.googleapis.com"),
      expect.any(Object)
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("projects/test-project/locations/us-central1"),
      expect.any(Object)
    );

    vi.unstubAllGlobals();
  });

  it("uses custom GOOGLE_LOCATION when set", async () => {
    process.env.GOOGLE_PROJECT_ID = "test-project";
    process.env.GOOGLE_LOCATION = "europe-west1";

    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ datasets: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { vertexRequest } = await import("../client.js");
    await vertexRequest("GET", "/datasets");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("europe-west1-aiplatform.googleapis.com"),
      expect.any(Object)
    );

    vi.unstubAllGlobals();
  });

  it("passes query params correctly", async () => {
    process.env.GOOGLE_PROJECT_ID = "test-project";

    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ datasets: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { vertexRequest } = await import("../client.js");
    await vertexRequest("GET", "/datasets", undefined, {
      filter: "display_name=\"test\"",
      pageSize: 10,
      pageToken: undefined,
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("filter=");
    expect(calledUrl).toContain("pageSize=10");
    expect(calledUrl).not.toContain("pageToken");

    vi.unstubAllGlobals();
  });

  it("throws on non-ok response", async () => {
    process.env.GOOGLE_PROJECT_ID = "test-project";

    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue("Not found"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { vertexRequest } = await import("../client.js");
    await expect(vertexRequest("GET", "/datasets/missing")).rejects.toThrow(
      "Vertex AI API error 404: Not found"
    );

    vi.unstubAllGlobals();
  });

  it("sends body as JSON for POST requests", async () => {
    process.env.GOOGLE_PROJECT_ID = "test-project";

    vi.doMock("google-auth-library", () => ({
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "mock-token" }),
        }),
      })),
    }));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: "op-123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { vertexRequest } = await import("../client.js");
    await vertexRequest("POST", "/datasets", {
      displayName: "test-dataset",
      metadataSchemaUri: "gs://test/schema.yaml",
    });

    const calledOptions = mockFetch.mock.calls[0][1];
    expect(calledOptions.method).toBe("POST");
    expect(calledOptions.headers.Authorization).toBe("Bearer mock-token");
    expect(calledOptions.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calledOptions.body)).toEqual({
      displayName: "test-dataset",
      metadataSchemaUri: "gs://test/schema.yaml",
    });

    vi.unstubAllGlobals();
  });
});
