import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { isSuperadmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  buildMembersHref,
  parseMembersParams,
  toListMembersArgs,
  type AdminMemberListRow,
} from "@/lib/admin/members-list";
import MembersFilters from "@/components/admin/members/MembersFilters";
import MembersExports from "@/components/admin/members/MembersExports";
import MembersList, { MembersLoadError } from "@/components/admin/members/MembersList";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin/members");
  return {
    title: t("admin_members_title"),
    description: t("admin_members_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("admin_members_title"),
      description: t("admin_members_description"),
      url: alternates.canonical,
    },
  };
}

export default async function AdminMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, rawParams] = await Promise.all([params, searchParams]);

  // Board members and superadmins only; anyone else gets the 404 page.
  const actor = await requireRole("board", "/admin/members");

  // Nothing from the URL reaches the RPC unchecked: it raises on unknown state, role or sort.
  const query = parseMembersParams(rawParams);

  // The user's own session (RLS and the RPC's role check apply): no service role here.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_members", toListMembersArgs(query));

  const rows = (data ?? []) as AdminMemberListRow[];
  if (error) {
    // Postgres code only: messages can echo values.
    console.error("[admin/members] list failed code=%s", error.code ?? "unknown");
  } else if (rows.length === 0 && query.page > 1) {
    // A page past the end (a stale link, a filter that shrank the list): back to the first page.
    return redirect({ href: buildMembersHref(query, { page: 1 }), locale });
  }

  const [tNav, tMeta] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_members"), path: "/admin/members" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin/members",
    tMeta("admin_members_title"),
    tMeta("admin_members_description"),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 sm:px-6 md:pt-16">
        <div className="flex flex-col gap-4 rounded-2xl bg-brand-white p-5 md:p-6">
          <MembersFilters query={query} />
          <MembersExports role={query.role} isSuperadmin={isSuperadmin(actor.role)} />
        </div>
        {error ? (
          <MembersLoadError query={query} />
        ) : (
          <MembersList rows={rows} total={rows[0]?.total_count ?? 0} query={query} />
        )}
      </div>
    </>
  );
}
