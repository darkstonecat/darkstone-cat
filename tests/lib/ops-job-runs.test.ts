import { format } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// src/lib/ops/job-runs.ts: one ops_job_runs row per refresh job, through the database
// functions of 20261006100200_ops_job_runs.sql. Recording never throws and never logs a message.

const { adminRpc } = vi.hoisted(() => ({ adminRpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));

import { recordAutomaticRuns, recordManualRuns } from "@/lib/ops/job-runs";

const results = [
  { name: "ludoya", ok: true, durationMs: 2100 },
  { name: "bgg", ok: false, durationMs: 30000, error: "BGG API timeout after retries for user@example.com", errorCode: "timeout" },
];

let spies: MockInstance[];
const output = () =>
  spies
    .flatMap((spy) => spy.mock.calls)
    .map((call) => format(...(call as [unknown, ...unknown[]])))
    .join("\n");

beforeEach(() => {
  adminRpc.mockResolvedValue({ data: 1, error: null });
  spies = [vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {})];
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("recordAutomaticRuns", () => {
  it("records each job with the service role and no actor, code only", async () => {
    await recordAutomaticRuns(results);

    expect(adminRpc).toHaveBeenCalledTimes(2);
    expect(adminRpc).toHaveBeenNthCalledWith(1, "ops_record_job_run", {
      p_job: "ludoya",
      p_ok: true,
      p_duration_ms: 2100,
      p_error_code: null,
    });
    expect(adminRpc).toHaveBeenNthCalledWith(2, "ops_record_job_run", {
      p_job: "bgg",
      p_ok: false,
      p_duration_ms: 30000,
      p_error_code: "timeout",
    });
  });

  it("logs a failed write with the job and the code only, and keeps going", async () => {
    adminRpc.mockResolvedValueOnce({ data: null, error: { code: "42P01", message: "relation ops_job_runs does not exist" } });

    await expect(recordAutomaticRuns(results)).resolves.toBeUndefined();

    expect(adminRpc).toHaveBeenCalledTimes(2);
    expect(output()).toContain("[ops] record_job_run failed job=ludoya code=42P01");
    expect(output()).not.toContain("does not exist");
  });

  it("never throws, even when the client does", async () => {
    adminRpc.mockRejectedValue(new Error("fetch failed for user@example.com"));

    await expect(recordAutomaticRuns(results)).resolves.toBeUndefined();

    expect(output()).toContain("job=bgg code=exception");
    expect(output()).not.toContain("example.com");
  });

  it("skips jobs it does not know and drops a malformed code", async () => {
    await recordAutomaticRuns([
      { name: "other", ok: true, durationMs: 1 },
      { name: "bgg", ok: false, durationMs: -5, errorCode: "Not a code" },
    ]);

    expect(adminRpc).toHaveBeenCalledTimes(1);
    expect(adminRpc).toHaveBeenCalledWith("ops_record_job_run", {
      p_job: "bgg",
      p_ok: false,
      p_duration_ms: null,
      p_error_code: "error",
    });
  });
});

describe("recordManualRuns", () => {
  it("records with the given session client through admin_record_job_run", async () => {
    const sessionRpc = vi.fn().mockResolvedValue({ data: 1, error: null });

    await recordManualRuns({ rpc: sessionRpc }, results);

    expect(adminRpc).not.toHaveBeenCalled();
    expect(sessionRpc).toHaveBeenCalledTimes(2);
    expect(sessionRpc).toHaveBeenCalledWith("admin_record_job_run", {
      p_job: "bgg",
      p_ok: false,
      p_duration_ms: 30000,
      p_error_code: "timeout",
    });
  });

  it("never throws on a refused write", async () => {
    const sessionRpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "ops:forbidden: board role required" } });

    await expect(recordManualRuns({ rpc: sessionRpc }, results)).resolves.toBeUndefined();
    expect(output()).toContain("code=42501");
    expect(output()).not.toContain("board role required");
  });
});
