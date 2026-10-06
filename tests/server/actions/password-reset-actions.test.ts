import { beforeEach, describe, expect, it, vi } from "vitest";

// Neutral password reset (spec §4.4, T26), src/lib/supabase/password-reset-actions.ts.
// The admin client, the cookie-less GoTrue client, the limiter and the request headers are mocked.

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  reset: vi.fn(),
  allow: vi.fn(),
  headers: {} as Record<string, string>,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(m.headers),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: m.rpc }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: m.reset } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  allowRequestShared: (...args: unknown[]) => m.allow(...args),
}));

import { requestPasswordReset } from "@/lib/supabase/password-reset-actions";

function logged(): string {
  return JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.headers = { "x-real-ip": "203.0.113.9", origin: "https://www.darkstone.cat", host: "www.darkstone.cat" };
  m.allow.mockResolvedValue(true);
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.reset.mockResolvedValue({ data: {}, error: null });
});

describe("requestPasswordReset", () => {
  it("sends the recovery link to /auth/callback for a confirmed, active account", async () => {
    expect(await requestPasswordReset("  Laia@Example.cat ")).toEqual({ error: null });
    expect(m.rpc).toHaveBeenCalledWith("is_email_confirmed", { p_email: "laia@example.cat" });
    expect(m.reset).toHaveBeenCalledWith("laia@example.cat", {
      redirectTo: "https://www.darkstone.cat/auth/callback",
    });
  });

  it("falls back to the host header when there is no Origin", async () => {
    m.headers = { "x-real-ip": "203.0.113.9", host: "localhost:3000", "x-forwarded-proto": "http" };
    await requestPasswordReset("laia@example.cat");
    expect(m.reset).toHaveBeenCalledWith("laia@example.cat", { redirectTo: "http://localhost:3000/auth/callback" });
  });

  it.each([
    ["unknown, unconfirmed or former", false],
    ["unexpected response", null],
  ])("sends nothing but answers the same for an %s account", async (_n, data) => {
    m.rpc.mockResolvedValue({ data, error: null });
    expect(await requestPasswordReset("ghost@example.cat")).toEqual({ error: null });
    expect(m.reset).not.toHaveBeenCalled();
  });

  it("answers the same, sending nothing, when the IP is throttled", async () => {
    m.allow.mockImplementation(async (scope: string) => scope !== "password-reset-ip");
    expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: null });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.reset).not.toHaveBeenCalled();
  });

  it("answers the same, sending nothing, when the address is throttled", async () => {
    m.allow.mockImplementation(async (scope: string) => scope !== "password-reset-email");
    expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: null });
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.reset).not.toHaveBeenCalled();
  });

  it("keys the limiters by client IP and by address", async () => {
    await requestPasswordReset("laia@example.cat");
    expect(m.allow).toHaveBeenCalledWith("password-reset-ip", "203.0.113.9", 10, 600_000);
    expect(m.allow).toHaveBeenCalledWith("password-reset-email", "laia@example.cat", 3, 600_000);
  });

  it.each([[{ code: "over_email_send_rate_limit", status: 429 }], [{ status: 429 }]])(
    "keeps GoTrue's rate limit neutral (%j)",
    async (error) => {
      m.reset.mockResolvedValue({ data: null, error });
      expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: null });
    }
  );

  it("reports a failure that does not depend on the address, without logging it", async () => {
    m.reset.mockResolvedValue({ data: null, error: { code: "unexpected_failure", status: 500 } });
    expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: "failed" });
    m.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: "failed" });
    expect(logged()).toContain("unexpected_failure");
    expect(logged()).not.toContain("laia");
  });

  it("never throws and never logs the address", async () => {
    m.rpc.mockRejectedValue(new Error("boom for laia@example.cat"));
    expect(await requestPasswordReset("laia@example.cat")).toEqual({ error: "failed" });
    expect(logged()).not.toContain("laia");
  });

  it.each(["", "not-an-email", `${"a".repeat(250)}@example.cat`, 42, null, undefined])(
    "rejects malformed input %j without touching Supabase",
    async (value) => {
      expect(await requestPasswordReset(value as string)).toEqual({ error: "failed" });
      expect(m.allow).not.toHaveBeenCalled();
      expect(m.rpc).not.toHaveBeenCalled();
      expect(m.reset).not.toHaveBeenCalled();
    }
  );
});
