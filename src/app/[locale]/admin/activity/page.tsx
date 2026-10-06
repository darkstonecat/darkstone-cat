import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_PAGE_SIZE, parseActivityParams, toActivityArgs } from "@/lib/admin/activity";
import type { AdminActivityRow } from "@/lib/admin/audit-format";
import type { AdminMemberListRow } from "@/lib/admin/members-list";
import Notice from "@/components/admin/Notice";
import ActivityFilters, { type ActivityActorOption } from "@/components/admin/activity/ActivityFilters";
import ActivityList, { ActivityLoadError } from "@/components/admin/activity/ActivityList";

// Audit data: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/admin/activity");
  return {
    title: t("admin_activity_title"),
    description: t("admin_activity_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("admin_activity_title"),
      description: t("admin_activity_description"),
      url: alternates.canonical,
    },
  };
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Board members and superadmins for the "Qui" select; a failure only leaves the fixed choices. */
async function loadActors(supabase: SessionClient): Promise<ActivityActorOption[]> {
  const lists = await Promise.all(
    (["superadmin", "board"] as const).map((role) =>
      supabase.rpc("admin_list_members", {
        p_state: "active",
        p_role: role,
        p_q: null,
        p_sort: "name_asc",
        p_limit: 200,
        p_offset: 0,
      }),
    ),
  );
  const seen = new Set<string>();
  const options: ActivityActorOption[] = [];
  for (const { data, error } of lists) {
    if (error) {
      // Postgres code only: messages can echo values.
      console.error("[admin/activity] actors failed code=%s", error.code ?? "unknown");
      continue;
    }
    for (const row of (data ?? []) as AdminMemberListRow[]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      options.push({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim() || row.member_number });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export default async function AdminActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, rawParams] = await Promise.all([params, searchParams]);

  // Board members and superadmins only; anyone else gets the 404 page.
  await requireRole("board", "/admin/activity");

  // Nothing from the URL reaches the RPC unchecked.
  const query = parseActivityParams(rawParams);

  // The user's own session: the RPC checks the role itself.
  const supabase = await createClient();
  const [{ data, error }, actors] = await Promise.all([
    supabase.rpc("admin_list_activity", toActivityArgs(query)),
    loadActors(supabase),
  ]);
  if (error) {
    console.error("[admin/activity] list failed code=%s", error.code ?? "unknown");
  }
  const fetched = (error ? [] : (data ?? [])) as AdminActivityRow[];
  const hasMore = fetched.length > ACTIVITY_PAGE_SIZE;
  const rows = fetched.slice(0, ACTIVITY_PAGE_SIZE);

  const [tNav, tMeta, t] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
    getTranslations({ locale, namespace: "admin.activity" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_activity"), path: "/admin/activity" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/admin/activity",
    tMeta("admin_activity_title"),
    tMeta("admin_activity_description"),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 sm:px-6 md:pt-16">
        <Notice kind="info">
          <p>{t("notice")}</p>
        </Notice>
        <ActivityFilters query={query} actors={actors} />
        {error ? (
          <ActivityLoadError query={query} />
        ) : (
          <ActivityList rows={rows} total={fetched[0]?.total_count ?? 0} hasMore={hasMore} query={query} />
        )}
      </div>
    </>
  );
}
