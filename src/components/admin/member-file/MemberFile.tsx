import { useTranslations } from "next-intl";
import { MdArrowBack, MdArrowForward } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { roleLabelKey, isBoardRole } from "@/lib/auth/roles";
import {
  KNOWN_BADGE_KEYS,
  activityKeyOf,
  formatAdminTimestamp,
  yearOf,
  type AdminActivityRow,
  type AdminMemberFileRow,
} from "@/lib/admin/member-file";
import { formatAdminDate } from "@/lib/admin/members-list";
import Notice from "../Notice";
import StatusChip from "../StatusChip";
import { Field } from "./Field";
import MemberDataExport from "./MemberDataExport";
import PersonalDataCard from "./PersonalDataCard";

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
};

const CARD = "rounded-2xl bg-brand-white p-5 md:p-8";

/**
 * V-3 read-only member file. Active members show their contact data; for a former member the
 * RPC already nulls everything BR-20 deletes, and this component never renders a placeholder
 * for those fields. DNI and phone are only ever "present or not" (the reveal is T19+). The edit,
 * leave/rejoin, badge, card, role and access-link buttons are omitted until T19-T22 wire them.
 */
export default function MemberFile({ member, activity, backHref, canExportData, canRevealFormerDni }: MemberFileProps) {
  const t = useTranslations("admin.member_file");
  const tAdmin = useTranslations("admin");
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const leftOn = formatAdminDate(member.left_on);
  const purgeOn = formatAdminDate(member.purge_on);
  const firstSignup = formatAdminDate(member.membership_start_date);
  const roleSince = isBoardRole(member.role) ? formatAdminTimestamp(member.role_since) : null;
  const badges = member.badges ?? [];
  const startYear = yearOf(member.membership_start_date);

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
        <section aria-labelledby="mf-badges" className={`${CARD} flex flex-col gap-4`}>
          <h3 id="mf-badges" className="text-xl font-bold text-stone-custom">
            {t("badges_title")}
          </h3>
          <ul className="flex flex-col">
            {startYear !== null && (
              <li className="flex flex-col gap-0.5 border-t border-stone-custom/10 py-3 first:border-0">
                <span className="font-semibold text-stone-custom">{t("badge_member_year", { year: startYear })}</span>
                <span className="text-[13px] text-stone-custom/65">{t("badge_automatic")}</span>
              </li>
            )}
            {badges.map((badge) => {
              const date = formatAdminTimestamp(badge.awarded_at);
              const known = (KNOWN_BADGE_KEYS as readonly string[]).includes(badge.badge_key);
              return (
                <li
                  key={badge.badge_key}
                  className="flex flex-col gap-0.5 border-t border-stone-custom/10 py-3 first:border-0"
                >
                  <span className="font-semibold text-stone-custom">
                    {known ? t(`badge_${badge.badge_key}`) : badge.badge_key}
                  </span>
                  <span className="text-[13px] text-stone-custom/65">
                    {date && badge.awarded_by_name
                      ? t("badge_awarded_by", { date, name: badge.awarded_by_name })
                      : date
                        ? t("badge_awarded", { date })
                        : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {badges.length === 0 && startYear === null && <p className="text-sm text-stone-custom/65">{t("badges_none")}</p>}
          {former && <p className="text-[13px] text-stone-custom/65">{t("badges_kept")}</p>}
        </section>

        <section aria-labelledby="mf-card" className={`${CARD} flex flex-col gap-3`}>
          <div className="flex items-center justify-between gap-3">
            <h3 id="mf-card" className="text-xl font-bold text-stone-custom">
              {t("card_title")}
            </h3>
            <StatusChip kind={member.card_valid ? "valid" : "invalid"} />
          </div>
          {former ? (
            <p className="text-sm text-stone-custom/70">{t("card_former")}</p>
          ) : (
            <p className="text-sm text-stone-custom/70">
              {formatAdminTimestamp(member.card_issued_at)
                ? t("card_issued", { date: formatAdminTimestamp(member.card_issued_at) ?? "" })
                : t("card_no_date")}
            </p>
          )}
          <p className="text-sm text-stone-custom/70">
            {t("role_card")} <strong className="text-stone-custom">{tAdmin(roleLabelKey(member.role))}</strong>
            {roleSince ? ` · ${t("role_since", { date: roleSince })}` : ""}
          </p>
        </section>
      </div>

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

/**
 * Short Catalan-style sentence per action. A local map until the shared audit renderer (T23)
 * replaces it; unknown actions fall back to the raw key.
 */
function ActivityEntry({ entry }: { entry: AdminActivityRow }) {
  const t = useTranslations("admin.member_file");
  const key = activityKeyOf(entry.action);
  const actor = entry.actor_name ?? entry.actor_member_number ?? t("activity_system");
  const target = entry.target_member_number ?? NO_VALUE;
  const date = formatAdminTimestamp(entry.created_at);
  return (
    <li className="flex flex-col gap-1 border-t border-stone-custom/10 py-3 first:border-0 sm:flex-row sm:gap-6">
      <time dateTime={entry.created_at} className="w-28 shrink-0 text-[13px] text-stone-custom/65">
        {date ?? NO_VALUE}
      </time>
      <p className="text-sm text-stone-custom">
        <strong>{actor}</strong>{" "}
        {key ? t(`activity.${key}`, { target }) : t("activity.unknown", { action: entry.action, target })}
      </p>
    </li>
  );
}
