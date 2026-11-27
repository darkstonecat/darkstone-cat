// The weekly member backup job (docs/features/member-backup/spec.md §4, §6), run by
// GET /api/cron/backup. Reads every member row with the service role (a scheduled job has no
// user), decrypts DNI/phone, writes a new Sheet in the shared drive and deletes the job's older
// Sheets beyond the newest BACKUP_KEEP. Never logs or returns member data: only counts and
// short error codes.

import "server-only";
import { decrypt } from "@/lib/encryption";
import { madridDay } from "@/lib/events/madrid-day";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectGoogle, GoogleApiError, parseFolderId, parseServiceAccount, type GoogleClient, type ServiceAccount } from "./google";
import { buildBackupSheet, type BackupMemberRow } from "./sheet";

/** Copies kept in the folder, the new one included (spec D-2). */
export const BACKUP_KEEP = 4;

export type BackupConfig = { account: ServiceAccount; folderId: string };

/** The Google settings from the environment, or null when one is missing or malformed. */
export function getBackupConfig(env: Record<string, string | undefined> = process.env): BackupConfig | null {
  const account = parseServiceAccount(env.GOOGLE_BACKUP_SERVICE_ACCOUNT);
  const folderId = parseFolderId(env.GOOGLE_BACKUP_FOLDER_ID);
  return account && folderId ? { account, folderId } : null;
}

export type BackupStep = "read" | "google" | "write" | "cleanup";

export type BackupResult =
  | { ok: true; rows: number; illegible: number; deleted: number; durationMs: number }
  | { ok: false; step: BackupStep; errorCode: string; rows: number | null; durationMs: number };

export type BackupDeps = {
  readRows: () => Promise<BackupMemberRow[]>;
  connect: (account: ServiceAccount) => Promise<GoogleClient>;
  now: () => Date;
};

async function readRowsWithServiceRole(): Promise<BackupMemberRow[]> {
  const { data, error } = await createAdminClient().rpc("backup_member_rows");
  if (error) throw new BackupReadError(error.code ? `db_${error.code}`.toLowerCase().slice(0, 40) : "db_error");
  if (!Array.isArray(data)) throw new BackupReadError("db_bad_shape");
  return data as BackupMemberRow[];
}

class BackupReadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const defaultDeps: BackupDeps = { readRows: readRowsWithServiceRole, connect: (a) => connectGoogle(a), now: () => new Date() };

const codeOf = (error: unknown, fallback: string): string =>
  error instanceof GoogleApiError || error instanceof BackupReadError ? error.code : fallback;

export function backupFileName(now: Date): string {
  return `Darkstone · Socis · ${madridDay(now)}`;
}

const DESCRIPTION =
  "Còpia de seguretat automàtica de la llista de socis de Darkstone Catalunya. Conté DNI i telèfons: " +
  "no la comparteixis ni la copiïs fora d'aquesta carpeta. Es genera cada setmana i només se'n " +
  `guarden les ${BACKUP_KEEP} últimes.`;

export async function runMemberBackup(config: BackupConfig, deps: BackupDeps = defaultDeps): Promise<BackupResult> {
  const started = Date.now();
  const fail = (step: BackupStep, errorCode: string, rows: number | null = null): BackupResult => ({
    ok: false,
    step,
    errorCode,
    rows,
    durationMs: Date.now() - started,
  });

  let members: BackupMemberRow[];
  try {
    members = await deps.readRows();
  } catch (error) {
    return fail("read", codeOf(error, "read_failed"));
  }
  const sheet = buildBackupSheet(members, decrypt);

  let google: GoogleClient;
  try {
    google = await deps.connect(config.account);
  } catch (error) {
    return fail("google", codeOf(error, "google_failed"), sheet.rows);
  }

  let fileId: string;
  try {
    fileId = await google.createSpreadsheet(config.folderId, backupFileName(deps.now()), DESCRIPTION);
  } catch (error) {
    return fail("write", codeOf(error, "write_failed"), sheet.rows);
  }
  try {
    await google.writeValues(fileId, sheet.values);
  } catch (error) {
    // An empty Sheet must not count as one of the kept copies.
    await google.deleteFile(fileId).catch(() => undefined);
    return fail("write", codeOf(error, "write_failed"), sheet.rows);
  }
  // Cosmetic (bold, frozen header): a failure leaves a complete copy, so it is ignored.
  await google.formatHeader(fileId).catch(() => undefined);

  let deleted = 0;
  try {
    const older = (await google.listBackups(config.folderId)).filter((file) => file.id !== fileId);
    for (const file of older.slice(BACKUP_KEEP - 1)) {
      await google.deleteFile(file.id);
      deleted += 1;
    }
  } catch (error) {
    return fail("cleanup", codeOf(error, "cleanup_failed"), sheet.rows);
  }

  return { ok: true, rows: sheet.rows, illegible: sheet.illegible, deleted, durationMs: Date.now() - started };
}
