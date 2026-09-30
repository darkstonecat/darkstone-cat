import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate } from "@/lib/format-date";
import MemberAvatar from "./MemberAvatar";
import MemberTabs, { type MemberTab } from "./MemberTabs";

type MemberHeroProps = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  membershipStartDate: string | null;
  active: MemberTab;
};

/** Dark hero of the member area: avatar, name, member line and the Inici / Perfil / Carnet tabs. */
export default function MemberHero({
  firstName,
  lastName,
  memberNumber,
  membershipStartDate,
  active,
}: MemberHeroProps) {
  const t = useTranslations("profile");
  const locale = useLocale();

  return (
    <section className="bg-stone-custom px-4 pt-32 pb-8 text-brand-white sm:px-6 sm:pb-12 md:px-12">
      <div className="mx-auto flex max-w-[960px] flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-7">
          <MemberAvatar firstName={firstName} lastName={lastName} />
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              {firstName} {lastName}
            </h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-brand-white/65">
              <span>
                {t("hero_number")} <strong className="font-bold text-brand-white">{memberNumber}</strong>
              </span>
              {membershipStartDate && (
                <span>
                  {t("hero_since")} {formatCalendarDate(membershipStartDate, locale)}
                </span>
              )}
            </p>
          </div>
        </div>
        <MemberTabs active={active} />
      </div>
    </section>
  );
}
