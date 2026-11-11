import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "./admin";

/** Cache tag of the public active-member count (the /about stats). */
export const MEMBER_COUNT_CACHE_TAG = "member-count";

/**
 * Active members = no leave date (`left_on IS NULL`), the same rule as `admin_stats()`.
 * A public page has no user, so it reads with the service role; `head: true` returns
 * only the count, never a row.
 */
async function countActiveMembers(): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("members")
    .select("id", { count: "exact", head: true })
    .is("left_on", null);
  if (error || count === null) {
    throw Object.assign(new Error("member count failed"), { code: error?.code ?? "no_count" });
  }
  return count;
}

// A failure throws, so it is never cached: the next visit tries again.
const cachedActiveMemberCount = unstable_cache(countActiveMembers, ["active-member-count"], {
  revalidate: 86400,
  tags: [MEMBER_COUNT_CACHE_TAG],
});

/** The cached active-member count, or null when it cannot be read. */
export async function fetchActiveMemberCount(): Promise<number | null> {
  try {
    return await cachedActiveMemberCount();
  } catch (error) {
    // Postgres code only: messages can echo values.
    const code = (error as { code?: unknown })?.code;
    console.error("[member-count] failed code=%s", typeof code === "string" ? code : "unknown");
    return null;
  }
}
