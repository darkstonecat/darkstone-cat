"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername } from "./username-pattern";

export type GamingService = "ludoya" | "bgg";

export type DetailsActionResult =
  | { error: null; username?: string | null }
  | { error: "unauthenticated" | "invalid" | "failed" };

const COLUMN: Record<GamingService, "ludoya_username" | "bgg_username"> = {
  ludoya: "ludoya_username",
  bgg: "bgg_username",
};

/** Updates one column of the signed-in member's own row (RLS `members_update_own` also enforces this). */
async function updateOwnMember(
  values: { ludoya_username: string | null } | { bgg_username: string | null } | { newsletter_accepted: boolean }
): Promise<DetailsActionResult["error"]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unauthenticated";

  // `.select` so that a row hidden by RLS (0 rows updated) is an error, not a silent success.
  const { data, error } = await supabase.from("members").update(values).eq("id", user.id).select("id");
  if (error || !data || data.length !== 1) return "failed";

  revalidatePath("/[locale]/profile", "page");
  revalidatePath("/[locale]/profile/details", "page");
  return null;
}

/**
 * Stores a Ludoya or BGG username on the current member. The soft existence
 * check is advisory and lives client-side (`check*Username`); it never gates this.
 */
export async function linkGamingAccount(
  service: GamingService,
  username: string
): Promise<DetailsActionResult> {
  if (service !== "ludoya" && service !== "bgg") return { error: "invalid" };
  const clean = normalizeUsername(username);
  if (!clean) return { error: "invalid" };

  const error = await updateOwnMember({ [COLUMN[service]]: clean } as { ludoya_username: string });
  return error ? { error } : { error: null, username: clean };
}

/** Clears the Ludoya or BGG username of the current member. */
export async function unlinkGamingAccount(service: GamingService): Promise<DetailsActionResult> {
  if (service !== "ludoya" && service !== "bgg") return { error: "invalid" };

  const error = await updateOwnMember({ [COLUMN[service]]: null } as { ludoya_username: null });
  return error ? { error } : { error: null, username: null };
}

/** Email opt-in switch of the profile ("Comunicacions per correu"). */
export async function setNewsletterAccepted(accepted: boolean): Promise<DetailsActionResult> {
  if (typeof accepted !== "boolean") return { error: "invalid" };

  const error = await updateOwnMember({ newsletter_accepted: accepted });
  return error ? { error } : { error: null };
}
