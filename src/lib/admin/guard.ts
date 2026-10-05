import "server-only";

import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { hasRoleAtLeast, toRole, type Role } from "@/lib/auth/roles";

/** Levels an admin page or route can require. */
export type AdminLevel = "board" | "superadmin";

export type AdminActor = {
  id: string;
  role: Role;
};

export type AdminAccess =
  | { status: "ok"; actor: AdminActor }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Non-redirecting check for API routes: map `unauthenticated` to 401 and
 * `forbidden` to 403. Reads the signed-in member with the session client (RLS
 * applies). Same rule as `public.has_role()`: the role must rank high enough and
 * the membership must be active, so a former member (`left_on` set) never gets
 * admin access, whatever the row still says. An unknown role or an unreadable
 * row is forbidden.
 */
export async function getAdminAccess(min: AdminLevel): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("members")
    .select("role, left_on")
    .eq("id", user.id)
    .single();

  if (error || !data) return { status: "forbidden" };
  if (data.left_on != null) return { status: "forbidden" };

  const role = toRole(data.role);
  if (role === null || !hasRoleAtLeast(role, min)) return { status: "forbidden" };

  return { status: "ok", actor: { id: user.id, role } };
}

/**
 * Guard for admin pages (server components). Returns the actor, redirects to the
 * localized login without a session (the proxy normally did that already) and
 * renders the 404 page for anyone without the role, so the panel does not reveal
 * itself to members.
 */
export async function requireRole(min: AdminLevel): Promise<AdminActor> {
  const access = await getAdminAccess(min);

  if (access.status === "unauthenticated") {
    const locale = await getLocale();
    return redirect({ href: "/login", locale });
  }
  if (access.status === "forbidden") notFound();

  return access.actor;
}
