/**
 * Letters (any script), digits, `_`, `.`, `-` and inner spaces, 1 to 64 long.
 * Broad enough for Ludoya handles and BGG usernames. Shared by the advisory
 * checks and by the actions that store a linked account.
 */
export const USERNAME_PATTERN = /^[\p{L}\p{N}_.\- ]{1,64}$/u;

/** Trims and drops a leading `@`; returns null when the result is not a valid username. */
export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().replace(/^@+/, "").trim();
  return USERNAME_PATTERN.test(clean) ? clean : null;
}
