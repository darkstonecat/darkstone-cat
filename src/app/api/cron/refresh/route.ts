// Scheduled cache refresh, called by .github/workflows/cache-refresh.yml with
// `Authorization: Bearer $CRON_SECRET`. Fails closed: no secret configured
// means no work, and the comparison is constant-time.

import { timingSafeEqual } from "node:crypto";
import { runRefreshJobs } from "@/lib/cache-refresh";

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
  const ok = jobs.every((job) => job.ok);
  return json({ ok, jobs }, ok ? 200 : 502);
}
