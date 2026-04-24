import { GoogleAuth } from "google-auth-library";

let cachedAuth: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return cachedAuth;
}

export function getProjectId(): string {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID environment variable is not set");
  return projectId;
}

export function getLocation(): string {
  return process.env.GOOGLE_LOCATION || "us-central1";
}

export async function getAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Failed to obtain access token from Google Cloud credentials");
  }
  return tokenResponse.token;
}

function getBaseUrl(): string {
  const location = getLocation();
  const projectId = getProjectId();
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}`;
}

export async function vertexRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { apiVersion?: string; global?: boolean; globalLocation?: boolean; noProjectPath?: boolean; timeoutMs?: number }
): Promise<T> {
  let baseUrl: string;
  const version = options?.apiVersion || "v1";
  if (options?.globalLocation) {
    // Global endpoint with project path: aiplatform.googleapis.com/v1/projects/{project}/locations/global
    // Used for preview models (Gemini 3.x, etc.) that are only available on the global endpoint
    const projectId = getProjectId();
    baseUrl = `https://aiplatform.googleapis.com/${version}/projects/${projectId}/locations/global`;
  } else if (options?.global) {
    baseUrl = `https://aiplatform.googleapis.com/${version}`;
  } else if (options?.noProjectPath) {
    const location = getLocation();
    baseUrl = `https://${location}-aiplatform.googleapis.com/${version}`;
  } else {
    const location = getLocation();
    const projectId = getProjectId();
    baseUrl = `https://${location}-aiplatform.googleapis.com/${version}/projects/${projectId}/locations/${location}`;
  }
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  if (!token) {
    throw new Error("Failed to obtain access token from Google Cloud credentials");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  // Apply an optional per-request timeout via AbortController
  const timeoutMs = options?.timeoutMs;
  let timeoutHandle: NodeJS.Timeout | undefined;
  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController();
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    fetchOptions.signal = controller.signal;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), fetchOptions);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Vertex AI request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vertex AI API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
