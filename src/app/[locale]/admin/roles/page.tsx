import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import type { AdminMemberListRow } from "@/lib/admin/members-list";
import type { AdminMemberFileRow } from "@/lib/admin/member-file";
import RolesContent, { type RoleHolder } from "@/components/admin/roles/RolesContent";

// Personal data and a live view of who holds a role: never cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin/roles");
  return {
    title: t("admin_roles_title"),
    description: t("admin_roles_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("admin_roles_title"),
      description: t("admin_roles_description"),
      url: alternates.canonical,
    },
  };
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Active holders of a role (session client: the RPCs check the role again) with their `role_since`. */
async function loadHolders(
  supabase: SessionClient,
  role: "board" | "superadmin",
): Promise<RoleHolder[] | null> {
  const { data, error } = await supabase.rpc("admin_list_members", {
    p_state: "active",
    p_role: role,
    p_q: null,
    p_sort: "name_asc",
    p_limit: 200,
    p_offset: 0,
  });
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/roles] list failed code=%s", error.code ?? "unknown");
    return null;
  }
  const rows = (data ?? []) as AdminMemberListRow[];
  // The list has no role_since; the member file function does. A handful of people, so one call each.
  return Promise.all(
    rows.map(async (row) => {
      const { data: file } = await supabase.rpc("admin_get_member", { p_member_number: row.member_number });
      const since = ((file ?? []) as AdminMemberFileRow[])[0]?.role_since ?? null;
      return {
        id: row.id,
        member_number: row.member_number,
        name: `${row.first_name} ${row.last_name}`.trim(),
        role_since: since,
      };
    }),
  );
}

export default async function AdminRolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Superadmins only; a board member (and anyone else) gets the 404 page. The tab is hidden too,
  // but hiding it is not the protection: this call is.
  const actor = await requireRole("superadmin", "/admin/roles");

  const supabase = await createClient();
  const [superadmins, board] = await Promise.all([
    loadHolders(supabase, "superadmin"),
    loadHolders(supabase, "board"),
  ]);

  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_roles"), path: "/admin/roles" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin/roles",
    tMeta("admin_roles_title"),
    tMeta("admin_roles_description"),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <RolesContent
        superadmins={superadmins ?? []}
        board={board ?? []}
        viewerId={actor.id}
        loadError={superadmins === null || board === null}
      />
    </>
  );
}
