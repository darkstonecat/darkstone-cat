// Scheduled cache refresh, called by .github/workflows/cache-refresh.yml with
// `Authorization: Bearer $CRON_SECRET`. Fails closed: no secret configured
// means no work, and the comparison is constant-time. Each job run is recorded in
// ops_job_runs as an automatic run (V-6); a failed recording is only logged and never
// changes the answer.

import { timingSafeEqual } from "node:crypto";
import { runRefreshJobs } from "@/lib/cache-refresh";
import { recordAutomaticRuns } from "@/lib/ops/job-runs";

export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  // timingSafeEqual throws on different lengths; the length itself is not secret.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return json({ error: "not_configured" }, 500);
  if (!isAuthorized(request.headers.get("authorization"), secret)) return json({ error: "unauthorized" }, 401);

  const jobs = await runRefreshJobs();
  try {
    await recordAutomaticRuns(jobs);
  } catch {
    // recordAutomaticRuns never throws; this only guards the answer against a future change.
    console.error("[ops] record_job_run failed job=all code=exception");
  }
  const ok = jobs.every((job) => job.ok);
  return json({ ok, jobs }, ok ? 200 : 502);
}
