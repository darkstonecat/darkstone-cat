"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { allowRequestShared } from "@/lib/rate-limit";
import { REFRESH_JOBS, runRefreshJobs } from "@/lib/cache-refresh";
import { recordManualRuns, type RpcClient } from "@/lib/ops/job-runs";
import type { AdminActionError } from "@/lib/admin/action-errors";

/*
 * A-14 · Refresh caches (V-6 "Memòria cau"). Runs the same jobs as the scheduled refresh
 * (src/lib/cache-refresh.ts) and answers the result per job. Steps, in this order:
 *
 *   1. `getAdminAccess('board')`.
 *   2. The job: 'ludoya', 'bgg' or 'all' (default); anything else is `invalid`.
 *   3. One manual refresh per board member per minute, shared by every instance (bucket
 *      `cache-refresh:<actor uuid>`), so repeated clicks do not hammer Ludoya or BGG.
 *   4. Run the selected jobs (a failing job never stops the other).
 *   5. Record each run in ops_job_runs with the SESSION client (`admin_record_job_run`: the
 *      database takes the actor from auth.uid()). Best effort, logged only.
 *   6. One `ops.cache_refresh` audit entry with `{"jobs":[…],"ok":bool}` (job names and a
 *      boolean: BR-15-safe). It is written after the run because it records the result. If it
 *      fails, the refresh has already happened and is harmless, so the results are still
 *      returned and only the Postgres code is logged.
 *   7. Revalidate the tools page.
 *
 * Results carry only the short error code (`refreshErrorCode`), never the upstream message.
 */

export type RefreshCachesJob = "ludoya" | "bgg" | "all";

export type RefreshCachesResult = {
  job: string;
  ok: boolean;
  durationMs: number;
  errorCode: string | null;
};

const WINDOW_MS = 60 * 1000;
const JOB_CHOICES: ReadonlySet<unknown> = new Set(["ludoya", "bgg", "all"]);

export async function refreshCaches(
  job: RefreshCachesJob = "all"
): Promise<{ ok: true; results: RefreshCachesResult[] } | { error: AdminActionError }> {
  const access = await getAdminAccess("board");
  if (access.status !== "ok") return { error: access.status };

  if (!JOB_CHOICES.has(job)) return { error: "invalid" };

  if (!(await allowRequestShared(`cache-refresh:${access.actor.id}`, null, 1, WINDOW_MS))) {
    return { error: "rate_limited" };
  }

  const selected = REFRESH_JOBS.filter((j) => job === "all" || j.name === job);
  const runs = await runRefreshJobs(selected);

  const supabase = await createClient();
  await recordManualRuns(supabase as unknown as RpcClient, runs);

  const logged = await supabase.rpc("log_admin_event", {
    p_action: "ops.cache_refresh",
    p_target: null,
    p_details: { jobs: runs.map((r) => r.name), ok: runs.every((r) => r.ok) },
    p_reason: null,
  });
  if (logged.error) {
    console.error("[admin-ops] cache_refresh_audit failed code=%s", logged.error.code || "unknown");
  }

  revalidatePath("/[locale]/admin/tools", "page");

  return {
    ok: true,
    results: runs.map((r) => ({
      job: r.name,
      ok: r.ok,
      durationMs: r.durationMs,
      errorCode: r.ok ? null : (r.errorCode ?? "error"),
    })),
  };
}
