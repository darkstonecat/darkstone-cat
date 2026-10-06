import { useTranslations } from "next-intl";
import { MdArrowBack, MdArrowForward } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { roleLabelKey } from "@/lib/auth/roles";
import {
  type AdminActivityRow,
  type AdminMemberFileRow,
} from "@/lib/admin/member-file";
import { formatAdminDate } from "@/lib/admin/members-list";
import Notice from "../Notice";
import StatusChip from "../StatusChip";
import { AuditActorLabel, AuditTimeLabel, useAuditLines } from "../activity/AuditParts";
import { Field } from "./Field";
import BadgesCard from "./BadgesCard";
import CardSection from "./CardSection";
import MemberDataExport from "./MemberDataExport";
import MembershipActions from "./MembershipActions";
import PersonalDataCard from "./PersonalDataCard";
import RoleCard from "./RoleCard";

const NO_VALUE = "—";

type MemberFileProps = {
  member: AdminMemberFileRow;
  activity: AdminActivityRow[];
  /** Validated `/admin/members…` URL of the list the board came from. */
  backHref: string;
  /** Former members' data can only be exported by a superadmin (D-D, provisional). */
  canExportData: boolean;
  /** Former member's DNI can only be revealed by a superadmin (D-E, provisional). */
  canRevealFormerDni: boolean;
  /** Superadmin viewer: the role card offers role changes and anonymisation. */
  canManageRoles: boolean;
  /** Id of the signed-in board member: their own file cannot be given a baixa (`self_target`). */
  viewerId: string;
};

const CARD = "rounded-2xl bg-brand-white p-5 md:p-8";

/**
 * V-3 read-only member file. Active members show their contact data; for a former member the
 * RPC already nulls everything BR-20 deletes, and this component never renders a placeholder
 * for those fields. DNI and phone are only ever "present or not" (revealed on demand). Edit and reveal
 * live in `PersonalDataCard`, leave/rejoin in `MembershipActions`; badges, card
 * and access link in their own cards, role and anonymise in `RoleCard`.
 */
export default function MemberFile({ member, activity, backHref, canExportData, canRevealFormerDni, canManageRoles, viewerId }: MemberFileProps) {
  const t = useTranslations("admin.member_file");
  const tAdmin = useTranslations("admin");
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const leftOn = formatAdminDate(member.left_on);
  const purgeOn = formatAdminDate(member.purge_on);
  const firstSignup = formatAdminDate(member.membership_start_date);

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 md:pt-16">
      <header className={`${CARD} flex flex-col gap-4`}>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-brand-orange-text"
        >
          <MdArrowBack aria-hidden="true" className="size-5" />
          {t("back")}
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="break-words text-3xl font-bold tracking-tight text-stone-custom md:text-5xl">{name}</h2>
            <p className="text-stone-custom/70">
              {t("member_line", { number: member.member_number })}
              {firstSignup ? ` · ${t("first_signup_line", { date: firstSignup })}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {former ? (
                <StatusChip kind="left" label={leftOn ? t("left_since", { date: leftOn }) : undefined} />
              ) : (
                <StatusChip kind="active" />
              )}
              <span className="text-sm text-stone-custom/70">
                {t("role_line")} <strong className="text-stone-custom">{tAdmin(roleLabelKey(member.role))}</strong>
              </span>
            </div>
          </div>
          {canExportData && (
            <MemberDataExport
              memberNumber={member.member_number}
              memberName={name}
              former={former}
            />
          )}
        </div>
        <MembershipActions member={member} isSelf={viewerId === member.id} />
      </header>

      {former && (
        <Notice kind="blocked">
          <p className="font-bold">{purgeOn ? t("blocked_title", { date: purgeOn }) : t("blocked_title_no_date")}</p>
          <p>{t("blocked_text")}</p>
        </Notice>
      )}

      <PersonalDataCard member={member} canRevealFormerDni={canRevealFormerDni} />

      <section aria-labelledby="mf-membership" className={`${CARD} flex flex-col gap-5`}>
        <h3 id="mf-membership" className="text-xl font-bold text-stone-custom">
          {t("membership_title")}
        </h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("first_signup")}>{firstSignup ?? NO_VALUE}</Field>
          <Field label={t("current_signup")}>{formatAdminDate(member.current_joined_on) ?? NO_VALUE}</Field>
          <Field label={t("leave_date")}>{leftOn ?? NO_VALUE}</Field>
          {former && (
            <>
              <Field label={t("left_by")}>
                {member.left_by === "self" ? t("left_by_self") : member.left_by === "board" ? t("left_by_board") : NO_VALUE}
              </Field>
              <Field label={t("leave_reason")}>{member.leave_reason || NO_VALUE}</Field>
              <Field label={t("purge_date")}>{purgeOn ? t("purge_on", { date: purgeOn }) : NO_VALUE}</Field>
            </>
          )}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BadgesCard member={member} />
        <CardSection member={member} />
      </div>

      <RoleCard member={member} canManage={canManageRoles} isSelf={viewerId === member.id} />

      <section aria-labelledby="mf-activity" className={`${CARD} flex flex-col gap-4`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id="mf-activity" className="text-xl font-bold text-stone-custom">
            {t("activity_title")}
          </h3>
          <Link
            href={`/admin/activity?target=${encodeURIComponent(member.member_number)}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-orange-text"
          >
            {t("activity_all")}
            <MdArrowForward aria-hidden="true" className="size-5" />
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-custom/65">{t("activity_empty")}</p>
        ) : (
          <ol className="flex flex-col">
            {activity.map((entry) => (
              <ActivityEntry key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** One entry of the "Activitat" card, worded by the shared audit renderer. */
function ActivityEntry({ entry }: { entry: AdminActivityRow }) {
  const { actor, sentence, detail } = useAuditLines(entry);
  return (
    <li className="flex flex-col gap-1 border-t border-stone-custom/10 py-3 first:border-0 sm:flex-row sm:gap-6">
      <span className="w-28 shrink-0 text-[13px] text-stone-custom/65">
        <AuditTimeLabel iso={entry.created_at} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-stone-custom">
          <AuditActorLabel actor={actor} withChip={false} /> {sentence}
        </p>
        {detail && <p className="text-[13px] break-words text-stone-custom/65">{detail}</p>}
      </div>
    </li>
  );
}
