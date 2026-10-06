// ---------------------------------------------------------------------------
// Cache refresh run history (admin panel V-6, T13)
// ---------------------------------------------------------------------------
// One public.ops_job_runs row per job run (supabase/migrations/20261006100200_ops_job_runs.sql),
// written only through its functions:
//   - automatic runs (/api/cron/refresh): `ops_record_job_run` with the service role, no actor;
//   - manual runs (A-14, `refreshCaches`): `admin_record_job_run` with the board member's
//     SESSION client, so the database takes the actor from auth.uid().
// Recording is best effort: it never throws and never changes the refresh outcome. A failure
// logs one line with the job name and the Postgres code only.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RefreshJobResult } from "@/lib/cache-refresh";

/** The jobs ops_job_runs accepts (its CHECK). */
const RECORDED_JOBS = new Set(["ludoya", "bgg"]);
const SHORT_CODE = /^[a-z0-9_]{1,40}$/;

type RpcResult = { error: { code?: string | null } | null };
/** The one method used, so a server or admin supabase client both fit. */
export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult> };

type RunResult = Pick<RefreshJobResult, "name" | "ok" | "durationMs" | "errorCode">;

function runArgs(result: RunResult) {
  const duration = Number.isInteger(result.durationMs) && result.durationMs >= 0 ? result.durationMs : null;
  // A failed run always carries a code; anything that is not a short code becomes `error`.
  const code = result.ok
    ? null
    : typeof result.errorCode === "string" && SHORT_CODE.test(result.errorCode)
      ? result.errorCode
      : "error";
  return { p_job: result.name, p_ok: result.ok, p_duration_ms: duration, p_error_code: code };
}

async function recordRuns(client: RpcClient, fn: string, results: RunResult[]): Promise<void> {
  for (const result of results) {
    if (!RECORDED_JOBS.has(result.name)) continue;
    let code: string | null | undefined;
    try {
      const { error } = await client.rpc(fn, runArgs(result));
      if (!error) continue;
      code = error.code || "unknown";
    } catch {
      code = "exception";
    }
    console.error("[ops] record_job_run failed job=%s code=%s", result.name, code);
  }
}

/** Scheduled runs (no actor). Never throws. */
export async function recordAutomaticRuns(results: RunResult[]): Promise<void> {
  try {
    await recordRuns(createAdminClient() as unknown as RpcClient, "ops_record_job_run", results);
  } catch {
    console.error("[ops] record_job_run failed job=all code=client");
  }
}

/** Manual runs from the panel; `client` is the board member's session client. Never throws. */
export async function recordManualRuns(client: RpcClient, results: RunResult[]): Promise<void> {
  await recordRuns(client, "admin_record_job_run", results);
}
