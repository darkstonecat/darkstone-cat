// Weekly member backup, called by .github/workflows/member-backup.yml with
// `Authorization: Bearer $CRON_SECRET` (same auth as /api/cron/refresh). Fails closed: no
// secret or no Google settings means no work, and the comparison is constant-time. Writes a
// Google Sheet with every member row in the shared drive (docs/features/member-backup/spec.md).
// Logs and answers carry counts and short codes only, never member data.

import { timingSafeEqual } from "node:crypto";
import { getBackupConfig, runMemberBackup } from "@/lib/backup/job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const config = getBackupConfig();
  if (!config) {
    console.error("[backup] not configured");
    return json({ error: "not_configured" }, 500);
  }

  const result = await runMemberBackup(config);
  if (!result.ok) {
    console.error("[backup] failed step=%s code=%s rows=%s", result.step, result.errorCode, result.rows ?? "-");
    return json({ ok: false, error: "backup_failed" }, 502);
  }

  console.info("[backup] ok rows=%d illegible=%d deleted=%d", result.rows, result.illegible, result.deleted);
  return json({ ok: true, rows: result.rows, illegible: result.illegible, deleted: result.deleted }, 200);
}
