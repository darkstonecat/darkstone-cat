import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: db.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    from: () => ({
      update: (values: unknown) => {
        db.update(values);
        return { eq: (...a: unknown[]) => (db.eq(...a), { select: db.select }) };
      },
    }),
  }),
}));

import { linkGamingAccount, setNewsletterAccepted, unlinkGamingAccount } from "@/lib/profile/details-actions";

beforeEach(() => {
  vi.clearAllMocks();
  db.user = { id: "user-1" };
  db.select.mockResolvedValue({ data: [{ id: "user-1" }], error: null });
});

describe("linkGamingAccount", () => {
  it("stores the normalised username on the signed-in member's own row", async () => {
    expect(await linkGamingAccount("ludoya", "  @laia_serra ")).toEqual({ error: null, username: "laia_serra" });
    expect(db.update).toHaveBeenCalledWith({ ludoya_username: "laia_serra" });
    expect(db.eq).toHaveBeenCalledWith("id", "user-1");
    expect(db.revalidatePath).toHaveBeenCalledWith("/[locale]/profile/details", "page");
  });

  it("uses the BGG column for bgg", async () => {
    await linkGamingAccount("bgg", "laia");
    expect(db.update).toHaveBeenCalledWith({ bgg_username: "laia" });
  });

  it("rejects invalid usernames and services without touching the database", async () => {
    for (const bad of ["", "a/b", "x".repeat(65), 5 as never]) {
      expect(await linkGamingAccount("bgg", bad)).toEqual({ error: "invalid" });
    }
    expect(await linkGamingAccount("steam" as never, "laia")).toEqual({ error: "invalid" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    db.user = null;
    expect(await linkGamingAccount("bgg", "laia")).toEqual({ error: "unauthenticated" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("fails when the update errors or RLS hides the row (0 rows)", async () => {
    db.select.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await linkGamingAccount("bgg", "laia")).toEqual({ error: "failed" });
    db.select.mockResolvedValueOnce({ data: [], error: null });
    expect(await linkGamingAccount("bgg", "laia")).toEqual({ error: "failed" });
    expect(db.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("unlinkGamingAccount", () => {
  it("clears only the requested column", async () => {
    expect(await unlinkGamingAccount("ludoya")).toEqual({ error: null, username: null });
    expect(db.update).toHaveBeenCalledWith({ ludoya_username: null });
  });

  it("rejects an unknown service", async () => {
    expect(await unlinkGamingAccount("x" as never)).toEqual({ error: "invalid" });
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("setNewsletterAccepted", () => {
  it("saves the boolean", async () => {
    expect(await setNewsletterAccepted(false)).toEqual({ error: null });
    expect(db.update).toHaveBeenCalledWith({ newsletter_accepted: false });
  });

  it("rejects non-boolean input", async () => {
    expect(await setNewsletterAccepted("yes" as never)).toEqual({ error: "invalid" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    db.select.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await setNewsletterAccepted(true)).toEqual({ error: "failed" });
  });
});
