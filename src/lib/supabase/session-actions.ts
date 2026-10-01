"use server";

import { createClient } from "./server";

/**
 * Revokes the current session server-side (scope `local`: only this session's
 * refresh token, other devices stay signed in) and clears the auth cookies
 * through the SSR cookie adapter. Never throws: the caller keeps its own
 * client-side cookie wipe as a fallback.
 */
export async function signOutCurrentSession(): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return { error: error ? "signout_failed" : null };
  } catch {
    return { error: "signout_failed" };
  }
}
