/**
 * Per-key concurrency limiter with minimum spacing between acquisitions.
 *
 * Used to smooth bursts of Vertex AI calls per model family (Gemini image,
 * Imagen, etc.) so we don't trigger 429 quota spikes even when the overall
 * rate would be fine.
 *
 * Two knobs:
 *  - maxConcurrent: how many in-flight calls are allowed at once
 *  - minSpacingMs: minimum time between the *start* of consecutive calls
 */

interface WaitingEntry {
  resolve: () => void;
}

interface KeyState {
  inFlight: number;
  lastStartAt: number; // epoch ms of the most recent acquire
  waiters: WaitingEntry[];
}

const states = new Map<string, KeyState>();

function getState(key: string): KeyState {
  let s = states.get(key);
  if (!s) {
    s = { inFlight: 0, lastStartAt: 0, waiters: [] };
    states.set(key, s);
  }
  return s;
}

export interface LimiterOptions {
  /** Per-key concurrency cap. Defaults vary by key (see resolveKeyLimit). */
  maxConcurrent: number;
  /** Minimum ms between consecutive acquires for this key. */
  minSpacingMs: number;
}

/**
 * Acquire a slot for the given key. Returns a release() function to call when
 * the work is done. Automatically waits for slot availability and respects
 * minSpacingMs.
 */
export async function acquire(key: string, opts: LimiterOptions): Promise<() => void> {
  const state = getState(key);

  // 1. Wait for a free concurrency slot
  if (state.inFlight >= opts.maxConcurrent) {
    await new Promise<void>((resolve) => {
      state.waiters.push({ resolve });
    });
  }

  // 2. Respect min spacing — even if slot is free, space out starts
  const now = Date.now();
  const sinceLast = now - state.lastStartAt;
  if (state.lastStartAt > 0 && sinceLast < opts.minSpacingMs) {
    await new Promise((r) => setTimeout(r, opts.minSpacingMs - sinceLast));
  }

  state.inFlight += 1;
  state.lastStartAt = Date.now();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.inFlight -= 1;
    // Wake the next waiter (if any) — but they'll re-check spacing after they wake
    const next = state.waiters.shift();
    if (next) next.resolve();
  };
}

/** Classify a model into a limiter key + default concurrency cap. */
export function resolveLimiterKey(model: string): { key: string; defaultMax: number } {
  if (/gemini.*image/i.test(model)) return { key: "gemini-image", defaultMax: 3 };
  if (model.startsWith("imagen-")) return { key: "imagen", defaultMax: 3 };
  if (model.startsWith("veo-")) return { key: "veo", defaultMax: 2 };
  return { key: "default", defaultMax: 10 };
}

/** Read per-key env-var overrides; fall back to the default. */
export function getLimiterOptions(model: string): LimiterOptions {
  const { key, defaultMax } = resolveLimiterKey(model);
  const envVar =
    key === "gemini-image" ? "VERTEX_AI_MCP_MAX_CONCURRENT_GEMINI_IMAGE" :
    key === "imagen" ? "VERTEX_AI_MCP_MAX_CONCURRENT_IMAGEN" :
    key === "veo" ? "VERTEX_AI_MCP_MAX_CONCURRENT_VEO" :
    "VERTEX_AI_MCP_MAX_CONCURRENT_DEFAULT";
  const rawMax = process.env[envVar];
  const maxConcurrent = rawMax ? Math.max(1, parseInt(rawMax, 10)) : defaultMax;
  const rawSpacing = process.env.VERTEX_AI_MCP_MIN_SPACING_MS;
  const minSpacingMs = rawSpacing ? Math.max(0, parseInt(rawSpacing, 10)) : 500;
  return { maxConcurrent, minSpacingMs };
}

/** Test-only: reset internal state. */
export function __resetLimiter(): void {
  states.clear();
}

export function getLimiterState(key: string): { inFlight: number; waiting: number } {
  const s = states.get(key);
  return { inFlight: s?.inFlight ?? 0, waiting: s?.waiters.length ?? 0 };
}
