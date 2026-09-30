// ---------------------------------------------------------------------------
// BoardGameGeek — username lookup
// ---------------------------------------------------------------------------

import "server-only";
import { XMLParser } from "fast-xml-parser";

export type BggUsernameStatus = "found" | "not_found" | "failed";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Does a BGG account with this username exist? `xmlapi2/user?name=` answers
 * 200 with `<user id="…" name="…">` for a known name. An unknown name comes
 * back as a 404 HTML page (verified 2026-09-30); a 200 with an empty id, which
 * older documentation describes, is treated the same way. Any other outcome,
 * including a missing token, is `failed`. Never throws and is never cached, so
 * a member who creates the account can retry at once.
 */
export async function lookupBggUsername(username: string): Promise<BggUsernameStatus> {
  const token = process.env.BGG_API_KEY;
  if (!token) return "failed";

  try {
    const res = await fetch(
      `https://boardgamegeek.com/xmlapi2/user?name=${encodeURIComponent(username)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      }
    );
    if (res.status === 404) return "not_found";
    if (res.status !== 200) return "failed";

    const user = parser.parse(await res.text())?.user;
    if (!user) return "failed"; // 200 but not a user document
    const id = String(user["@_id"] ?? "").trim();
    return id ? "found" : "not_found";
  } catch (error) {
    console.warn("[BGG] Username check failed:", error instanceof Error ? error.name : "unknown error");
    return "failed";
  }
}
