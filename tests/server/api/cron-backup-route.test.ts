import { format } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// GET /api/cron/backup (docs/features/member-backup/spec.md §6). The job is mocked; it is
// covered by tests/lib/backup-job.test.ts.

const job = vi.hoisted(() => ({
  config: { account: { clientEmail: "sa@x", privateKey: "k" }, folderId: "1AbCdEfGhIjKlMn" } as unknown,
  run: vi.fn(),
}));

const recordAutomaticRuns = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/ops/job-runs", () => ({ recordAutomaticRuns }));

vi.mock("@/lib/backup/job", () => ({
  getBackupConfig: () => job.config,
  runMemberBackup: job.run,
}));

import { GET } from "@/app/api/cron/backup/route";

const SECRET = "test-cron-secret";
const call = (authorization: string | null = `Bearer ${SECRET}`) =>
  GET(new Request("https://www.darkstone.cat/api/cron/backup", { headers: authorization ? { authorization } : {} }));

let consoleSpies: MockInstance[];
const consoleOutput = () =>
  consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => format(...(args as [unknown, ...unknown[]])))
    .join("\n");

describe("GET /api/cron/backup", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    job.config = { account: { clientEmail: "sa@x", privateKey: "k" }, folderId: "1AbCdEfGhIjKlMn" };
    job.run.mockResolvedValue({ ok: true, rows: 208, illegible: 0, deleted: 1, durationMs: 1200 });
    consoleSpies = (["error", "warn", "log", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 500 without doing work when CRON_SECRET is unset or empty", async () => {
    for (const value of ["", "   "]) {
      vi.stubEnv("CRON_SECRET", value);
      const res = await call(`Bearer ${value}`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "not_configured" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(job.run).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing, wrong or different-length token", async () => {
    for (const header of [null, "Bearer wrong-secret-xx", "Bearer x", SECRET]) {
      const res = await call(header);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    expect(job.run).not.toHaveBeenCalled();
  });

  it("returns 500 not_configured without the Google settings", async () => {
    job.config = null;
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(job.run).not.toHaveBeenCalled();
  });

  it("returns the counts on success, no-store", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, rows: 208, illegible: 0, deleted: 1 });
    expect(consoleOutput()).toContain("[backup] ok rows=208 illegible=0 deleted=1");
    expect(recordAutomaticRuns).toHaveBeenCalledWith([{ name: "member_backup", ok: true, durationMs: 1200 }]);
  });

  it("returns 502 backup_failed and logs only the step and code", async () => {
    job.run.mockResolvedValue({ ok: false, step: "write", errorCode: "sheets_write_403", rows: 208, durationMs: 900 });
    const res = await call();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "backup_failed" });
    expect(consoleOutput()).toBe("[backup] failed step=write code=sheets_write_403 rows=208");
    expect(recordAutomaticRuns).toHaveBeenCalledWith([
      { name: "member_backup", ok: false, durationMs: 900, errorCode: "sheets_write_403" },
    ]);
  });

  it("records nothing for a refused request, and a failed run when Google is not configured", async () => {
    await call("Bearer wrong-secret-xx");
    expect(recordAutomaticRuns).not.toHaveBeenCalled();
    job.config = null;
    await call();
    expect(recordAutomaticRuns).toHaveBeenCalledWith([
      { name: "member_backup", ok: false, durationMs: 0, errorCode: "not_configured" },
    ]);
  });
});
