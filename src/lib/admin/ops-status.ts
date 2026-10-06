// Last run per cache refresh job, as `admin_ops_status()` returns it (V-6 "Memòria cau").

export type OpsJobName = "ludoya" | "bgg";
export const OPS_JOBS: readonly OpsJobName[] = ["ludoya", "bgg"];

export type OpsJobStatus = {
  job: OpsJobName;
  /** ISO timestamp of the last run; null = never ran. */
  lastRunAt: string | null;
  lastOk: boolean | null;
  /** The last run had no actor (the scheduled refresh). */
  lastAutomatic: boolean | null;
  lastActorName: string | null;
  lastActorNumber: string | null;
  lastDurationMs: number | null;
  /** Short code only (`timeout`, `http_503`), never an upstream message. */
  lastErrorCode: string | null;
  lastSuccessAt: string | null;
};

const SHORT_CODE = /^[a-z0-9_]{1,40}$/;

const str = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);
const iso = (value: unknown): string | null => {
  const text = str(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

/**
 * Validates the rows of `admin_ops_status()`: one entry per known job, in display order.
 * Unknown jobs are dropped, malformed fields become null; a missing job gets an empty status.
 * Returns null when the answer is not an array (treated as a failure by the page).
 */
export function parseOpsStatus(data: unknown): OpsJobStatus[] | null {
  if (!Array.isArray(data)) return null;
  return OPS_JOBS.map((job) => {
    const raw = data.find((row) => row && typeof row === "object" && (row as { job?: unknown }).job === job) as
      | Record<string, unknown>
      | undefined;
    const row = raw ?? {};
    const duration = row.last_duration_ms;
    const code = str(row.last_error_code);
    return {
      job,
      lastRunAt: iso(row.last_run_at),
      lastOk: bool(row.last_ok),
      lastAutomatic: bool(row.last_automatic),
      lastActorName: str(row.last_actor_name),
      lastActorNumber: str(row.last_actor_member_number),
      lastDurationMs: typeof duration === "number" && Number.isInteger(duration) && duration >= 0 ? duration : null,
      lastErrorCode: code && SHORT_CODE.test(code) ? code : null,
      lastSuccessAt: iso(row.last_success_at),
    };
  });
}
