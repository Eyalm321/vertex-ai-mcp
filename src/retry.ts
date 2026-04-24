/**
 * Retry helper with truncated exponential backoff and jitter.
 *
 * Used to absorb transient 429 RESOURCE_EXHAUSTED and 503 UNAVAILABLE errors
 * from Vertex AI (especially Nano Banana Pro) without surfacing them to callers.
 */

export interface RetryAttempt {
  attempt: number; // 1-indexed retry number (attempt 1 = first retry, not the initial call)
  error: string;
  waitedMs: number;
  timestamp: string; // ISO
}

export interface RetryOptions {
  maxRetries?: number;
  /** Base backoff in ms. Doubles each attempt, capped at maxBackoffMs. */
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  /** Jitter multiplier range [min, max]. Default [0.5, 1.5]. */
  jitterRange?: [number, number];
  /** Called after each failed attempt (before the wait). */
  onAttempt?: (attempt: RetryAttempt) => void;
  /** Predicate to decide whether an error is worth retrying. */
  isRetryable?: (err: Error) => boolean;
  /** Hard ceiling on total retry time (ms). Stop retrying past this. */
  maxTotalTimeMs?: number;
}

const DEFAULT_OPTS: Required<Pick<RetryOptions, "maxRetries" | "baseBackoffMs" | "maxBackoffMs" | "jitterRange" | "maxTotalTimeMs">> = {
  maxRetries: 5,
  baseBackoffMs: 2000,
  maxBackoffMs: 32000,
  jitterRange: [0.5, 1.5],
  maxTotalTimeMs: 60000,
};

/** Default retryable-error classifier: 429, 503, network errors, aborts/timeouts. */
export function isRetryableError(err: Error): boolean {
  const msg = err.message;
  // Vertex AI API errors have status in the message: "Vertex AI API error 429: ..."
  if (/Vertex AI API error (429|503)\b/.test(msg)) return true;
  // Our own timeout message
  if (/Vertex AI request timed out/i.test(msg)) return true;
  // Native fetch errors (undici): "fetch failed", "ECONNRESET", "ETIMEDOUT"
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) return true;
  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { maxRetries, baseBackoffMs, maxBackoffMs, jitterRange, maxTotalTimeMs } = { ...DEFAULT_OPTS, ...opts };
  const isRetryable = opts.isRetryable ?? isRetryableError;
  const startedAt = Date.now();

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err as Error;
      lastError = error;
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }
      // Compute backoff with jitter
      const exponential = Math.min(baseBackoffMs * Math.pow(2, attempt), maxBackoffMs);
      const jitter = jitterRange[0] + Math.random() * (jitterRange[1] - jitterRange[0]);
      const waitMs = Math.round(exponential * jitter);
      // Respect total-time ceiling
      if (Date.now() - startedAt + waitMs > maxTotalTimeMs) {
        throw new Error(
          `${error.message} — giving up after ${attempt + 1} attempts (${Math.round((Date.now() - startedAt) / 1000)}s elapsed). Consider filing a Quota Increase Request or reducing concurrent request rate.`,
        );
      }
      opts.onAttempt?.({
        attempt: attempt + 1,
        error: error.message,
        waitedMs: waitMs,
        timestamp: new Date().toISOString(),
      });
      // eslint-disable-next-line no-console
      console.error(`[vertex-ai-mcp] Retry ${attempt + 1}/${maxRetries} after ${waitMs}ms: ${error.message}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastError ?? new Error("withRetry exhausted without an error — should be unreachable");
}
