import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  deleteUser: vi.fn(),
  allow: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc, auth: { admin: { deleteUser: m.deleteUser } } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  allowRequestShared: (...args: unknown[]) => m.allow(...args),
}));

import { prepareSignup } from "@/lib/supabase/actions";

const STALE_ID = "11111111-1111-1111-1111-111111111111";
const errorCalls = () =>
  JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.allow.mockResolvedValue(true);
  m.rpc.mockResolvedValue({ data: STALE_ID, error: null });
  m.deleteUser.mockResolvedValue({ error: null });
});

describe("prepareSignup", () => {
  it("deletes the stale unconfirmed user for the (normalised) email", async () => {
    expect(await prepareSignup("  Laia@Example.cat ")).toEqual({ ok: true });
    expect(m.rpc).toHaveBeenCalledWith("unconfirmed_user_id", { p_email: "laia@example.cat" });
    expect(m.deleteUser).toHaveBeenCalledWith(STALE_ID);
  });

  it.each([
    ["unknown or confirmed", null],
    ["empty", ""],
    ["unexpected response", 42],
  ])("deletes nothing and answers the same for an %s account", async (_n, data) => {
    m.rpc.mockResolvedValue({ data, error: null });
    expect(await prepareSignup("laia@example.cat")).toEqual({ ok: true });
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("answers the same, deleting nothing, when the IP is throttled", async () => {
    m.allow.mockResolvedValue(false);
    expect(await prepareSignup("laia@example.cat")).toEqual({ ok: true });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("is limited per client IP only, so nobody can burn a victim's bucket", async () => {
    await prepareSignup("laia@example.cat");
    expect(m.allow).toHaveBeenCalledTimes(1);
    expect(m.allow).toHaveBeenCalledWith("signup-prepare-ip", "203.0.113.9", expect.any(Number), expect.any(Number));
  });

  it("never blocks the sign-up when the lookup fails", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await prepareSignup("laia@example.cat")).toEqual({ ok: true });
    expect(m.deleteUser).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("never blocks the sign-up when the delete fails", async () => {
    m.deleteUser.mockResolvedValue({ error: { status: 500 } });
    expect(await prepareSignup("laia@example.cat")).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("never throws and never logs the address", async () => {
    m.rpc.mockRejectedValue(new Error("boom for laia@example.cat"));
    expect(await prepareSignup("laia@example.cat")).toEqual({ ok: true });
    expect(errorCalls()).not.toContain("laia");
  });

  it.each(["", "not-an-email", `${"a".repeat(250)}@example.cat`, 42, null, undefined])(
    "ignores malformed input %j without touching Supabase",
    async (value) => {
      expect(await prepareSignup(value as string)).toEqual({ ok: true });
      expect(m.allow).not.toHaveBeenCalled();
      expect(m.rpc).not.toHaveBeenCalled();
    }
  );
});
