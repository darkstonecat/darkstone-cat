// Daily retention job, called by .github/workflows/retention.yml with
// `Authorization: Bearer $CRON_SECRET` (same auth as /api/cron/refresh). Fails
// closed: no secret configured means no work, and the comparison is
// constant-time. A DRY RUN unless the query string carries exactly `apply=1`:
// the first production run must report what it would delete before anything is
// deleted (prod runbook, odd/tasks/admin-panel.md).

import { timingSafeEqual } from "node:crypto";
import { runRetention } from "@/lib/retention";

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

  const apply = new URL(request.url).searchParams.get("apply") === "1";
  const result = await runRetention({ apply });

  if (!result.ok) {
    // Only the Postgres code: the message can name rows or values.
    console.error("[retention] failed code=%s", result.code);
    return json({ ok: false, error: "retention_failed" }, 502);
  }

  const { dryRun, membersPurged, unconfirmedDeleted, auditEntriesDeleted } = result.summary;
  console.info(
    "[retention] dry_run=%s members_purged=%d unconfirmed_deleted=%d audit_entries_deleted=%d",
    dryRun,
    membersPurged,
    unconfirmedDeleted,
    auditEntriesDeleted
  );
  return json({ ok: true, ...result.summary }, 200);
}
