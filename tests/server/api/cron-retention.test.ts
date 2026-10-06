import { format } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// GET /api/cron/retention (T12). The service-role client is mocked; the database function
// run_retention() is covered by tests/integration/retention.test.ts.

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  result: { data: null, error: null } as { data: unknown; error: { code?: string; message: string } | null },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: unknown) => (db.rpc(fn, args), db.result),
  }),
}));

import { GET } from "@/app/api/cron/retention/route";

const SECRET = "test-cron-secret";
const call = (query = "", authorization: string | null = `Bearer ${SECRET}`) =>
  GET(
    new Request(`https://www.darkstone.cat/api/cron/retention${query}`, {
      headers: authorization ? { authorization } : {},
    })
  );

const SUMMARY = { dry_run: true, members_purged: 2, unconfirmed_deleted: 3, audit_entries_deleted: 4 };
let consoleSpies: MockInstance[];

function consoleOutput(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => format(...(args as [unknown, ...unknown[]])))
    .join("\n");
}

describe("GET /api/cron/retention", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    db.result = { data: [SUMMARY], error: null };
    consoleSpies = (["error", "warn", "log", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 500 without doing work when CRON_SECRET is unset or empty", async () => {
    for (const value of ["", "   "]) {
      vi.stubEnv("CRON_SECRET", value);
      const res = await call("", `Bearer ${value}`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "not_configured" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing, wrong or different-length token", async () => {
    for (const header of [null, "Bearer wrong-secret-xx", "Bearer x", SECRET]) {
      const res = await call("?apply=1", header);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("is a dry run unless apply=1 is passed exactly", async () => {
    for (const query of ["", "?apply=0", "?apply=true", "?apply=yes", "?apply=", "?dryRun=false"]) {
      db.rpc.mockClear();
      const res = await call(query);
      expect(res.status).toBe(200);
      expect(db.rpc).toHaveBeenCalledExactlyOnceWith("run_retention", { p_dry_run: true });
    }
  });

  it("returns the summary with no-store", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      dryRun: true,
      membersPurged: 2,
      unconfirmedDeleted: 3,
      auditEntriesDeleted: 4,
    });
  });

  it("applies with apply=1", async () => {
    db.result = { data: [{ ...SUMMARY, dry_run: false }], error: null };
    const res = await call("?apply=1");
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("run_retention", { p_dry_run: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, dryRun: false });
  });

  it("logs one summary line with counts only", async () => {
    await call("?apply=1");
    const output = consoleOutput();
    expect(output.split("\n")).toHaveLength(1);
    expect(output).toBe(
      "[retention] dry_run=true members_purged=2 unconfirmed_deleted=3 audit_entries_deleted=4"
    );
  });

  it("answers 502 and logs only the Postgres code when the job fails", async () => {
    db.result = {
      data: null,
      error: { code: "42501", message: "permission denied for table users (laia@example.com)" },
    };
    const res = await call("?apply=1");
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: false, error: "retention_failed" });
    const output = consoleOutput();
    expect(output).toBe("[retention] failed code=42501");
    expect(output).not.toContain("laia");
  });

  it("answers 502 on an unexpected result shape", async () => {
    for (const data of [null, [], [{ dry_run: true }], [{ ...SUMMARY, members_purged: "2" }]]) {
      db.result = { data, error: null };
      const res = await call();
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ ok: false, error: "retention_failed" });
    }
  });
});
