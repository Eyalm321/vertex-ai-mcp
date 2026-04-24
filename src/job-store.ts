/**
 * In-memory job store for long-running generation tasks.
 *
 * Used to work around Claude Code's hardcoded 60s MCP tool-call timeout:
 * the tool returns a jobId immediately, work continues in the background,
 * and the agent polls via vertex_get_job.
 *
 * Jobs expire 1 hour after completion. Running jobs are auto-failed after
 * 15 minutes. Store is capped at 100 entries — oldest evicted first.
 */

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobError {
  code: string;
  message: string;
}

interface InternalJob {
  id: string;
  toolName: string;
  model?: string;
  status: JobStatus;
  result?: unknown;
  error?: JobError;
  submittedAt: number; // epoch ms
  completedAt?: number; // epoch ms
  params?: Record<string, unknown>;
}

export interface JobView {
  jobId: string;
  toolName: string;
  model?: string;
  status: JobStatus;
  submittedAt: string; // ISO
  completedAt: string | null;
  elapsedSeconds: number;
  result?: unknown;
  error?: JobError;
  params?: Record<string, unknown>;
}

const COMPLETED_TTL_MS = 60 * 60 * 1000; // keep completed jobs 1 hour
const RUNNING_MAX_MS = 15 * 60 * 1000; // auto-fail running jobs after 15 min
const MAX_JOBS = 100;

const jobs = new Map<string, InternalJob>();

function now(): number {
  return Date.now();
}

function pruneAndTimeout(): void {
  const t = now();
  for (const [id, job] of jobs) {
    if ((job.status === "completed" || job.status === "failed")
        && job.completedAt !== undefined
        && t - job.completedAt > COMPLETED_TTL_MS) {
      jobs.delete(id);
      continue;
    }
    if ((job.status === "running" || job.status === "pending")
        && t - job.submittedAt > RUNNING_MAX_MS) {
      job.status = "failed";
      job.error = { code: "TIMEOUT", message: `Job exceeded ${RUNNING_MAX_MS / 60000}-minute maximum runtime` };
      job.completedAt = t;
    }
  }
}

function enforceCap(): void {
  if (jobs.size <= MAX_JOBS) return;
  const excess = jobs.size - MAX_JOBS;
  let removed = 0;
  for (const id of jobs.keys()) {
    if (removed >= excess) break;
    jobs.delete(id);
    removed++;
  }
}

function randomId(): string {
  const { randomBytes } = require("crypto") as typeof import("crypto");
  return randomBytes(16).toString("hex");
}

function toView(job: InternalJob): JobView {
  const completedAt = job.completedAt;
  return {
    jobId: job.id,
    toolName: job.toolName,
    model: job.model,
    status: job.status,
    submittedAt: new Date(job.submittedAt).toISOString(),
    completedAt: completedAt ? new Date(completedAt).toISOString() : null,
    elapsedSeconds: Math.round(((completedAt ?? now()) - job.submittedAt) / 1000),
    ...(job.result !== undefined ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
    ...(job.params ? { params: job.params } : {}),
  };
}

export function createJob(toolName: string, opts?: { model?: string; params?: Record<string, unknown> }): JobView {
  pruneAndTimeout();
  const job: InternalJob = {
    id: randomId(),
    toolName,
    model: opts?.model,
    params: opts?.params,
    status: "pending",
    submittedAt: now(),
  };
  jobs.set(job.id, job);
  enforceCap();
  return toView(job);
}

export function getJob(id: string): JobView | undefined {
  pruneAndTimeout();
  const job = jobs.get(id);
  return job ? toView(job) : undefined;
}

export function listJobs(opts?: { limit?: number; status?: JobStatus }): JobView[] {
  pruneAndTimeout();
  const limit = opts?.limit ?? 20;
  const out: JobView[] = [];
  // Iterate newest first
  const arr = [...jobs.values()].reverse();
  for (const job of arr) {
    if (opts?.status && job.status !== opts.status) continue;
    out.push(toView(job));
    if (out.length >= limit) break;
  }
  return out;
}

function markRunning(id: string): void {
  const job = jobs.get(id);
  if (job && job.status === "pending") job.status = "running";
}

function completeJob(id: string, result: unknown): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "completed";
  job.result = result;
  job.completedAt = now();
}

function failJob(id: string, error: JobError): void {
  const job = jobs.get(id);
  if (!job) return;
  job.status = "failed";
  job.error = error;
  job.completedAt = now();
}

/**
 * Run a generation task in the background, recording its result/error on the
 * given job. Fire-and-forget — callers should return the job view immediately.
 * Flips status to "running" on next tick; to "completed"/"failed" on finish.
 */
export function runAsyncJob(jobId: string, task: () => Promise<unknown>): void {
  // Defer to next tick so callers see "pending" if they poll immediately
  queueMicrotask(() => {
    markRunning(jobId);
    task()
      .then((result) => completeJob(jobId, result))
      .catch((err) => failJob(jobId, {
        code: "API_ERROR",
        message: (err as Error).message,
      }));
  });
}

/** Test-only: reset the store. */
export function __resetJobStore(): void {
  jobs.clear();
}

/** Expose size for tests/debugging. */
export function jobStoreSize(): number {
  return jobs.size;
}
