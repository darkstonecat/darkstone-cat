import { describe, expect, it, vi } from "vitest";

// The weekly member backup job (docs/features/member-backup/spec.md §4, §6). Google and the
// database are faked through the job's dependencies; encryption is real (ENCRYPTION_KEY of the
// test env), so the Sheet carries the decrypted DNI.

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: vi.fn() }) }));

import { encrypt } from "@/lib/encryption";
import { GoogleApiError, type BackupFile, type GoogleClient } from "@/lib/backup/google";
import { BACKUP_KEEP, backupFileName, getBackupConfig, runMemberBackup, type BackupDeps } from "@/lib/backup/job";
import { BACKUP_HEADERS, type BackupMemberRow } from "@/lib/backup/sheet";

const ID = "11111111-1111-4111-8111-111111111111";
const config = { account: { clientEmail: "sa@x.iam.gserviceaccount.com", privateKey: "unused" }, folderId: "1AbCdEfGhIjKlMn" };
const NOW = new Date("2026-11-29T23:30:00Z"); // already 2026-11-30 in Madrid

const member = (over: Partial<BackupMemberRow> = {}): BackupMemberRow => ({
  id: ID,
  member_number: "000-001",
  first_name: "Anna",
  last_name: "Puig",
  email: "anna@example.com",
  dni_nie_encrypted: encrypt("12345678Z", ID),
  phone_encrypted: null,
  postal_code: "08221",
  ludoya_username: null,
  bgg_username: null,
  role: "superadmin",
  newsletter_accepted: true,
  membership_start_date: "2020-03-01",
  current_joined_on: "2020-03-01",
  left_on: null,
  left_by: null,
  leave_reason: null,
  anonymised_at: null,
  created_at: "2020-03-01T10:00:00Z",
  badges: null,
  ...over,
});

function fakeGoogle(existing: BackupFile[] = [], fail: Partial<Record<keyof GoogleClient, string>> = {}) {
  const written: string[][][] = [];
  const deleted: string[] = [];
  const created: { folderId: string; name: string; description: string }[] = [];
  const guard = (method: keyof GoogleClient) => {
    if (fail[method]) throw new GoogleApiError(fail[method]!);
  };
  const client: GoogleClient = {
    async createSpreadsheet(folderId, name, description) {
      guard("createSpreadsheet");
      created.push({ folderId, name, description });
      return "new-sheet";
    },
    async writeValues(_id, values) {
      guard("writeValues");
      written.push(values);
    },
    async formatHeader() {
      guard("formatHeader");
    },
    async listBackups() {
      guard("listBackups");
      return [{ id: "new-sheet", createdTime: "2026-11-30T03:00:00Z" }, ...existing];
    },
    async deleteFile(id) {
      if (fail.deleteFile && id !== "new-sheet") throw new GoogleApiError(fail.deleteFile);
      deleted.push(id);
    },
  };
  return { client, written, deleted, created };
}

const deps = (google: GoogleClient, rows: BackupMemberRow[] = [member()]): BackupDeps => ({
  readRows: async () => rows,
  connect: async () => google,
  now: () => NOW,
});

const weeks = (n: number): BackupFile[] =>
  Array.from({ length: n }, (_, i) => ({ id: `week-${i + 1}`, createdTime: `2026-11-${String(23 - i * 7).padStart(2, "0")}T03:00:00Z` }));

describe("getBackupConfig", () => {
  it("needs both Google settings", () => {
    const key = Buffer.from(JSON.stringify({ client_email: "a@b", private_key: "-----BEGIN PRIVATE KEY-----x" })).toString("base64");
    expect(getBackupConfig({ GOOGLE_BACKUP_SERVICE_ACCOUNT: key, GOOGLE_BACKUP_FOLDER_ID: "1AbCdEfGhIjKlMn" })).not.toBeNull();
    expect(getBackupConfig({ GOOGLE_BACKUP_SERVICE_ACCOUNT: key })).toBeNull();
    expect(getBackupConfig({ GOOGLE_BACKUP_FOLDER_ID: "1AbCdEfGhIjKlMn" })).toBeNull();
  });
});

describe("runMemberBackup", () => {
  it("writes one Sheet named by the Madrid date with the decrypted rows", async () => {
    const google = fakeGoogle();
    const result = await runMemberBackup(config, deps(google.client));
    expect(result).toMatchObject({ ok: true, rows: 1, illegible: 0, deleted: 0 });
    expect(google.created).toEqual([
      { folderId: config.folderId, name: "Darkstone · Socis · 2026-11-30", description: expect.stringContaining("DNI") },
    ]);
    expect(backupFileName(NOW)).toBe("Darkstone · Socis · 2026-11-30");
    const [values] = google.written;
    expect(values[0]).toEqual([...BACKUP_HEADERS]);
    expect(values[1][BACKUP_HEADERS.indexOf("DNI/NIE")]).toBe("12345678Z");
    expect(values[1][BACKUP_HEADERS.indexOf("CP")]).toBe("08221");
  });

  it(`keeps the newest ${BACKUP_KEEP} copies, the new one included, and deletes the rest`, async () => {
    const google = fakeGoogle(weeks(5));
    const result = await runMemberBackup(config, deps(google.client));
    expect(result).toMatchObject({ ok: true, deleted: 2 });
    expect(google.deleted).toEqual(["week-4", "week-5"]);
  });

  it("deletes nothing while there are fewer copies than the limit", async () => {
    const google = fakeGoogle(weeks(BACKUP_KEEP - 1));
    expect(await runMemberBackup(config, deps(google.client))).toMatchObject({ ok: true, deleted: 0 });
    expect(google.deleted).toEqual([]);
  });

  it("counts secrets that do not decrypt and still succeeds", async () => {
    const google = fakeGoogle();
    const rows = [member({ dni_nie_encrypted: encrypt("X1234567L", "22222222-2222-4222-8222-222222222222") })];
    expect(await runMemberBackup(config, deps(google.client, rows))).toMatchObject({ ok: true, illegible: 1 });
  });

  it("fails at read without touching Google", async () => {
    const connect = vi.fn();
    const result = await runMemberBackup(config, {
      readRows: async () => Promise.reject(new Error("boom")),
      connect,
      now: () => NOW,
    });
    expect(result).toMatchObject({ ok: false, step: "read", errorCode: "read_failed", rows: null });
    expect(connect).not.toHaveBeenCalled();
  });

  it("fails at google when the sign-in is refused", async () => {
    const result = await runMemberBackup(config, {
      ...deps(fakeGoogle().client),
      connect: async () => Promise.reject(new GoogleApiError("google_auth_400")),
    });
    expect(result).toMatchObject({ ok: false, step: "google", errorCode: "google_auth_400", rows: 1 });
  });

  it("deletes the empty Sheet when the cells cannot be written, and keeps the old copies", async () => {
    const google = fakeGoogle(weeks(5), { writeValues: "sheets_write_403" });
    const result = await runMemberBackup(config, deps(google.client));
    expect(result).toMatchObject({ ok: false, step: "write", errorCode: "sheets_write_403" });
    expect(google.deleted).toEqual(["new-sheet"]);
  });

  it("ignores a failed header format", async () => {
    const google = fakeGoogle([], { formatHeader: "sheets_format_500" });
    expect(await runMemberBackup(config, deps(google.client))).toMatchObject({ ok: true });
  });

  it("reports a failed clean-up after a complete upload", async () => {
    const google = fakeGoogle(weeks(5), { deleteFile: "drive_delete_403" });
    const result = await runMemberBackup(config, deps(google.client));
    expect(result).toMatchObject({ ok: false, step: "cleanup", errorCode: "drive_delete_403", rows: 1 });
    expect(google.written).toHaveLength(1);
  });
});
