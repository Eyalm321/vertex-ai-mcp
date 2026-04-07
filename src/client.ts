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

function getProjectId(): string {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  if (!projectId) throw new Error("GOOGLE_PROJECT_ID environment variable is not set");
  return projectId;
}

function getLocation(): string {
  return process.env.GOOGLE_LOCATION || "us-central1";
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
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const baseUrl = getBaseUrl();
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

  const options: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(url.toString(), options);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vertex AI API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
