import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { isBadgeKey, toBadgeHolders, type AdminBadgeRow } from "@/lib/admin/badges";
import BadgeDetail from "@/components/admin/badges/BadgeDetail";

// Holders are personal data: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("admin_badge_title"),
    description: t("admin_badge_description"),
    alternates: getAlternates(locale, "/admin/badges"),
    robots: { index: false, follow: false },
  };
}

/** One badge (S7.3): edit its texts and icon, see and manage its holders. */
export default async function AdminBadgePage({ params }: { params: Promise<{ locale: string; key: string }> }) {
  const { key } = await params;

  // Same shape the database accepts; anything else is a 404 without touching the database.
  if (!isBadgeKey(key)) notFound();

  await requireRole("board", `/admin/badges/${key}`);

  // The user's own session: the functions check the role again.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_badges", {});
  if (error) {
    // Postgres code only: messages can echo values. An unreadable catalogue reads as not found.
    console.error("[admin/badge] list failed code=%s", error.code ?? "unknown");
    notFound();
  }
  const badge = (Array.isArray(data) ? (data as AdminBadgeRow[]) : []).find((row) => row.key === key);
  if (!badge) notFound();

  const { data: holderRows, error: holdersError } = await supabase.rpc("admin_list_badge_holders", { p_key: key });
  if (holdersError) {
    console.error("[admin/badge] holders failed code=%s", holdersError.code ?? "unknown");
  }

  return (
    <BadgeDetail
      badge={badge}
      holders={holdersError ? [] : toBadgeHolders(holderRows)}
      holdersError={Boolean(holdersError)}
    />
  );
}
