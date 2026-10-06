import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import MemberTabs, { type MemberTab } from "./MemberTabs";

type MemberHeaderProps = {
  title: string;
  memberNumber: string;
  membershipStartDate: string | null;
  active: MemberTab;
  /** Right column (e.g. a card). Stacks below the left column on small screens. */
  aside?: React.ReactNode;
  /** Rendered below the tabs, so it can never move anything above it. */
  children?: React.ReactNode;
  /** Keep the aside stacked below the left column until `xl` (for wide asides). */
  wideAside?: boolean;
  className?: string;
};

/**
 * Dark header shared by the three member-area views (Inici / Perfil / Carnet).
 * Fixed order in the left column: eyebrow, title, member line, tabs, optional children.
 * Both columns align to the top so the left column never shifts with the aside's height.
 */
export default function MemberHeader({
  title,
  memberNumber,
  membershipStartDate,
  active,
  aside,
  children,
  wideAside = false,
  className,
}: MemberHeaderProps) {
  const t = useTranslations("profile");
  const locale = useLocale();

  return (
    <section className={cn("bg-stone-custom px-4 pt-32 pb-8 text-brand-white md:px-12 md:pb-16", className)}>
      <div
        className={cn(
          "mx-auto flex max-w-[1120px] flex-col gap-6 md:gap-12",
          wideAside ? "xl:flex-row xl:items-start xl:justify-between" : "md:flex-row md:items-start md:justify-between"
        )}
      >
        <div className="flex min-w-0 flex-col gap-3.5">
          <p className="text-[13px] font-semibold tracking-[0.3em] text-brand-white/65 uppercase">
            {t("card.eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl">{title}</h1>
          <p className="text-[15px] leading-normal text-brand-white/65 md:text-lg">
            {t("hero_number")} <strong className="font-bold text-brand-white">{memberNumber}</strong>
            {membershipStartDate && (
              <>
                {" · "}
                {t("hero_since")} {formatCalendarDate(membershipStartDate, locale)}
              </>
            )}
          </p>
          <MemberTabs active={active} className="pt-2.5" />
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}
