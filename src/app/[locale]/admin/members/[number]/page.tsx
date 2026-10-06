import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAlternates } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { isSuperadmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  MEMBER_ACTIVITY_LIMIT,
  backToListHref,
  isValidMemberNumber,
  type AdminActivityRow,
  type AdminMemberFileRow,
} from "@/lib/admin/member-file";
import MemberFile from "@/components/admin/member-file/MemberFile";

// Personal data: never cached or prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  // The title never carries the member's name or number.
  return {
    title: t("admin_members_title"),
    alternates: getAlternates(locale, "/admin/members"),
    robots: { index: false, follow: false },
  };
}

export default async function AdminMemberFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ number }, rawParams] = await Promise.all([params, searchParams]);

  // Same shape the A-11 route accepts; anything else is a 404 without touching the database.
  if (!isValidMemberNumber(number)) notFound();

  const actor = await requireRole("board", `/admin/members/${number}`);

  // The user's own session: the RPCs check the role and apply the BR-20/21 column rules.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_member", { p_member_number: number });
  if (error) {
    // Postgres code only: messages can echo values. An unreadable file reads as not found.
    console.error("[admin/member] load failed code=%s", error.code ?? "unknown");
    notFound();
  }
  const member = ((data ?? []) as AdminMemberFileRow[])[0];
  // Unknown, purged and unconfirmed members all come back as zero rows.
  if (!member) notFound();

  const { data: activityData, error: activityError } = await supabase.rpc("admin_list_activity", {
    p_target: member.id,
    p_limit: MEMBER_ACTIVITY_LIMIT,
  });
  if (activityError) {
    console.error("[admin/member] activity failed code=%s", activityError.code ?? "unknown");
  }
  const activity = (activityError ? [] : (activityData ?? [])) as AdminActivityRow[];

  // D-D (provisional): a board member may export an active member's data, a former member's only a superadmin.
  const canExportData = member.state === "active" || isSuperadmin(actor.role);

  return (
    <MemberFile
      member={member}
      activity={activity}
      backHref={backToListHref(rawParams.list)}
      canExportData={canExportData}
      canRevealFormerDni={isSuperadmin(actor.role)}
      canManageRoles={isSuperadmin(actor.role)}
      viewerId={actor.id}
    />
  );
}
