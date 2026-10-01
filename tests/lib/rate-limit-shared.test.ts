import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { allowRequestShared, resetRateLimits } from "@/lib/rate-limit";

const IP = "203.0.113.77";

/** Mimics `supabase.rpc(...).abortSignal(...)`, which resolves to { data, error }. */
function resolveWith(result: { data: unknown; error: unknown }) {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve(result) });
}

beforeEach(() => {
  vi.restoreAllMocks();
  rpc.mockReset();
  createAdminClient.mockReset();
  createAdminClient.mockReturnValue({ rpc });
  resetRateLimits();
  vi.stubEnv("ENCRYPTION_KEY", "ab".repeat(32));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("allowRequestShared", () => {
  it("returns what the database function decides", async () => {
    resolveWith({ data: true, error: null });
    expect(await allowRequestShared("contact", IP, 5, 3_600_000)).toBe(true);
    resolveWith({ data: false, error: null });
    expect(await allowRequestShared("contact", IP, 5, 3_600_000)).toBe(false);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("sends limit and window in seconds, and a bucket without the raw IP", async () => {
    resolveWith({ data: true, error: null });
    await allowRequestShared("contact", IP, 5, 3_600_000);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("rate_limit_hit");
    expect(args).toMatchObject({ p_max: 5, p_window_seconds: 3600 });
    expect(args.p_bucket).toMatch(/^contact:[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(IP);
  });

  it("derives a stable per-identity bucket", async () => {
    resolveWith({ data: true, error: null });
    await allowRequestShared("contact", IP, 5, 1000);
    await allowRequestShared("contact", IP, 5, 1000);
    await allowRequestShared("contact", "198.51.100.1", 5, 1000);
    const buckets = rpc.mock.calls.map((c) => c[1].p_bucket);
    expect(buckets[0]).toBe(buckets[1]);
    expect(buckets[2]).not.toBe(buckets[0]);
  });

  it("changes the bucket when the secret changes", async () => {
    resolveWith({ data: true, error: null });
    await allowRequestShared("contact", IP, 5, 1000);
    vi.stubEnv("ENCRYPTION_KEY", "cd".repeat(32));
    await allowRequestShared("contact", IP, 5, 1000);
    expect(rpc.mock.calls[0][1].p_bucket).not.toBe(rpc.mock.calls[1][1].p_bucket);
  });

  it("uses the scope as bucket when there is no identity (global bucket)", async () => {
    resolveWith({ data: true, error: null });
    await allowRequestShared("contact:global", null, 50, 86_400_000);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_bucket: "contact:global",
      p_max: 50,
      p_window_seconds: 86_400,
    });
  });

  it("falls back to the in-memory limiter on an RPC error, without logging the IP", async () => {
    resolveWith({ data: null, error: { code: "PGRST301", message: "boom" } });
    expect(await allowRequestShared("contact", IP, 2, 60_000)).toBe(true);
    expect(await allowRequestShared("contact", IP, 2, 60_000)).toBe(true);
    expect(await allowRequestShared("contact", IP, 2, 60_000)).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(IP);
  });

  it("falls back when the response is not a boolean", async () => {
    resolveWith({ data: "yes", error: null });
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(true);
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(false);
  });

  it("falls back when the call throws or times out", async () => {
    rpc.mockReturnValue({ abortSignal: () => Promise.reject(new DOMException("timeout", "TimeoutError")) });
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(true);
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(false);
  });

  it("falls back when the admin client cannot be created (missing env)", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("supabaseUrl is required.");
    });
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(true);
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(false);
  });

  it("falls back for per-IP buckets when ENCRYPTION_KEY is missing, never calling the database", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(true);
    expect(await allowRequestShared("s", IP, 1, 60_000)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps working for global buckets without ENCRYPTION_KEY", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    resolveWith({ data: false, error: null });
    expect(await allowRequestShared("s:global", null, 1, 60_000)).toBe(false);
  });
});
