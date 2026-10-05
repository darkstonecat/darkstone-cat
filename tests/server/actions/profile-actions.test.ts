import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  update: vi.fn(),
  eq: vi.fn(),
  updateUser: vi.fn(),
  result: { error: null } as { error: { message: string; code?: string } | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: db.user } }),
      updateUser: db.updateUser,
    },
    from: () => ({
      update: (values: unknown) => {
        db.update(values);
        return { eq: async (...a: unknown[]) => (db.eq(...a), db.result) };
      },
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getProfileData: vi.fn() }));
vi.mock("@/lib/encryption", () => ({
  // Records the member id the value is bound to (AAD, T7b): always the caller's own row.
  encrypt: (v: string, memberId: string) => `enc(${v}|${memberId})`,
  decrypt: (v: string) => v,
}));

import { updateMemberProfile } from "@/lib/profile/actions";

const valid = {
  first_name: "  Laia ",
  last_name: "Serra",
  phone: "+34 600 123 456",
  dni: "12345678Z",
  postal_code: "08221",
  ludoya_username: "@laia_serra",
  bgg_username: "laia",
  newsletter_accepted: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.user = { id: "user-1" };
  db.result = { error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateMemberProfile", () => {
  it("stores trimmed, validated, normalised values on the caller's own row", async () => {
    expect(await updateMemberProfile(valid)).toEqual({ error: null });
    expect(db.update).toHaveBeenCalledWith({
      first_name: "Laia",
      last_name: "Serra",
      postal_code: "08221",
      ludoya_username: "laia_serra",
      bgg_username: "laia",
      newsletter_accepted: true,
      phone_encrypted: "enc(+34 600 123 456|user-1)",
      dni_nie_encrypted: "enc(12345678Z|user-1)",
    });
    expect(db.eq).toHaveBeenCalledWith("id", "user-1");
    expect(db.updateUser).toHaveBeenCalledWith({ data: { first_name: "Laia", last_name: "Serra" } });
  });

  it("clears optional fields that are blank or missing", async () => {
    await updateMemberProfile({
      first_name: "A",
      last_name: "B",
      phone: " ",
      newsletter_accepted: false,
    });
    expect(db.update).toHaveBeenCalledWith({
      first_name: "A",
      last_name: "B",
      postal_code: null,
      ludoya_username: null,
      bgg_username: null,
      newsletter_accepted: false,
      phone_encrypted: null,
      dni_nie_encrypted: null,
    });
  });

  it("requires a signed-in user", async () => {
    db.user = null;
    expect(await updateMemberProfile(valid)).toEqual({ error: "unauthenticated" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([
    ["blank first name", { first_name: "  " }, "invalid_name"],
    ["blank last name", { last_name: "" }, "invalid_name"],
    ["first name over 100 chars", { first_name: "a".repeat(101) }, "invalid_name"],
    ["last name over 100 chars", { last_name: "a".repeat(101) }, "invalid_name"],
    ["phone with letters", { phone: "abc123456" }, "invalid_phone"],
    ["phone over 20 chars", { phone: "6".repeat(21) }, "invalid_phone"],
    ["malformed DNI", { dni: "1234" }, "invalid_dni"],
    ["postal code with 4 digits", { postal_code: "8221" }, "invalid_postal_code"],
    ["username with a slash", { ludoya_username: "a/b" }, "invalid_username"],
    ["username over 64 chars", { bgg_username: "x".repeat(65) }, "invalid_username"],
  ])("rejects %s without touching the database", async (_label, patch, code) => {
    expect(await updateMemberProfile({ ...valid, ...patch })).toEqual({ error: code });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns a validation error, not a crash, for non-string input", async () => {
    for (const patch of [
      { first_name: 5 },
      { last_name: { a: 1 } },
      { phone: 600123456 },
      { dni: ["12345678Z"] },
      { postal_code: 8221 },
      { ludoya_username: {} },
    ]) {
      const res = await updateMemberProfile({ ...valid, ...patch } as never);
      expect(res.error).toMatch(/^invalid/);
    }
    expect(await updateMemberProfile({ ...valid, newsletter_accepted: "yes" } as never)).toEqual({
      error: "invalid",
    });
    expect(await updateMemberProfile(null as never)).toEqual({ error: "invalid" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("never leaks the database message and logs only the error code", async () => {
    db.result = { error: { message: 'duplicate key value violates "x" (Laia)', code: "23505" } };
    const res = await updateMemberProfile(valid);
    expect(res).toEqual({ error: "failed" });
    expect(JSON.stringify(res)).not.toContain("duplicate");
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "23505");
    expect(db.updateUser).not.toHaveBeenCalled();
  });
});
