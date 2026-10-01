import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  signInWithOtp: vi.fn(),
  allow: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithOtp: m.signInWithOtp } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  allowRequestShared: (...args: unknown[]) => m.allow(...args),
}));

import { requestMagicLink } from "@/lib/supabase/magic-link-actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.allow.mockResolvedValue(true);
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.signInWithOtp.mockResolvedValue({ error: null });
});

describe("requestMagicLink", () => {
  it("sends the link, without creating users, for a confirmed account", async () => {
    expect(await requestMagicLink("  Laia@Example.cat ")).toEqual({ error: null });
    expect(m.rpc).toHaveBeenCalledWith("is_email_confirmed", { p_email: "laia@example.cat" });
    expect(m.signInWithOtp).toHaveBeenCalledWith({
      email: "laia@example.cat",
      options: { shouldCreateUser: false },
    });
  });

  it.each([
    ["unknown", false],
    ["unconfirmed", false],
    ["unexpected response", null],
  ])("sends nothing but answers the same for an %s account", async (_n, data) => {
    m.rpc.mockResolvedValue({ data, error: null });
    expect(await requestMagicLink("ghost@example.cat")).toEqual({ error: null });
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });

  it("answers the same, sending nothing, when the IP is throttled", async () => {
    m.allow.mockImplementation(async (scope: string) => scope !== "magic-link-ip");
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: null });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });

  it("answers the same, sending nothing, when the address is throttled", async () => {
    m.allow.mockImplementation(async (scope: string) => scope !== "magic-link-email");
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: null });
    expect(m.signInWithOtp).not.toHaveBeenCalled();
  });

  it("keys the limiters by client IP and by address", async () => {
    await requestMagicLink("laia@example.cat");
    expect(m.allow).toHaveBeenCalledWith("magic-link-ip", "203.0.113.9", expect.any(Number), expect.any(Number));
    expect(m.allow).toHaveBeenCalledWith("magic-link-email", "laia@example.cat", expect.any(Number), expect.any(Number));
  });

  it.each([
    [{ code: "otp_disabled", status: 422 }],
    [{ code: "over_email_send_rate_limit", status: 429 }],
    [{ status: 429 }],
  ])("keeps GoTrue's neutral outcomes neutral (%j)", async (error) => {
    m.signInWithOtp.mockResolvedValue({ error });
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: null });
  });

  it("reports a failure that does not depend on the email", async () => {
    m.signInWithOtp.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: "failed" });
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: "failed" });
  });

  it("never throws and never logs the address", async () => {
    m.rpc.mockRejectedValue(new Error("boom for laia@example.cat"));
    expect(await requestMagicLink("laia@example.cat")).toEqual({ error: "failed" });
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain("laia");
  });

  it.each(["", "not-an-email", `${"a".repeat(250)}@example.cat`, 42, null, undefined])(
    "rejects malformed input %j without touching Supabase",
    async (value) => {
      expect(await requestMagicLink(value as string)).toEqual({ error: "failed" });
      expect(m.rpc).not.toHaveBeenCalled();
      expect(m.signInWithOtp).not.toHaveBeenCalled();
    }
  );
});
