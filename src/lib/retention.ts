// ---------------------------------------------------------------------------
// Retention job (admin panel spec §4.5, §5.3) — server side of /api/cron/retention
// ---------------------------------------------------------------------------
// `run_retention(p_dry_run)` (supabase/migrations/20261006100100_retention.sql)
// does all the work in one transaction: it purges former members 3 years after
// their leave, deletes sign-ups never confirmed after 30 days (auth.users rows
// included, so the deletion and its audit entry are atomic) and deletes audit
// entries older than 3 years. This module only calls it with the service role
// and checks the shape of the answer: counts, never ids or personal data.

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RetentionSummary {
  dryRun: boolean;
  membersPurged: number;
  unconfirmedDeleted: number;
  auditEntriesDeleted: number;
}

export type RetentionResult = { ok: true; summary: RetentionSummary } | { ok: false; code: string };

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** Runs the job; `apply: false` is a dry run that changes nothing. Never throws. */
export async function runRetention({ apply }: { apply: boolean }): Promise<RetentionResult> {
  try {
    const { data, error } = await createAdminClient().rpc("run_retention", { p_dry_run: !apply });
    if (error) return { ok: false, code: error.code || "unknown" };

    const row = Array.isArray(data) && data.length === 1 ? (data[0] as Record<string, unknown>) : null;
    if (
      !row ||
      typeof row.dry_run !== "boolean" ||
      !isCount(row.members_purged) ||
      !isCount(row.unconfirmed_deleted) ||
      !isCount(row.audit_entries_deleted)
    ) {
      return { ok: false, code: "unexpected_shape" };
    }

    return {
      ok: true,
      summary: {
        dryRun: row.dry_run,
        membersPurged: row.members_purged,
        unconfirmedDeleted: row.unconfirmed_deleted,
        auditEntriesDeleted: row.audit_entries_deleted,
      },
    };
  } catch {
    return { ok: false, code: "exception" };
  }
}
