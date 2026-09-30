import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { MdArrowForward } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { formatCalendarDate } from "@/lib/format-date";
import MemberTabs from "./MemberTabs";

type HomeHeroProps = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  membershipStartDate: string | null;
};

/** Dark hero of "La meva zona": greeting, member line, tabs and the mini card linking to the full card. */
export default function HomeHero({ firstName, lastName, memberNumber, membershipStartDate }: HomeHeroProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("profile.card");
  const locale = useLocale();

  return (
    <section className="bg-stone-custom px-4 pt-32 pb-8 text-brand-white md:px-12 md:pb-16">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-12">
        <div className="flex min-w-0 flex-col gap-3.5">
          <p className="text-[13px] font-semibold tracking-[0.3em] text-brand-white/65 uppercase">
            {t("card.eyebrow")}
          </p>
          <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl">
            {t("home.greeting", { name: firstName })}
          </h1>
          <p className="text-[15px] leading-normal text-brand-white/65 md:text-lg">
            {t("hero_number")} <strong className="font-bold text-brand-white">{memberNumber}</strong>
            {membershipStartDate && (
              <>
                {" · "}
                {t("hero_since")} {formatCalendarDate(membershipStartDate, locale)}
              </>
            )}
          </p>
          <MemberTabs active="home" className="pt-2.5" />
        </div>

        <Link
          href="/profile/card"
          className="group mt-3 flex w-full shrink-0 flex-col gap-[18px] rounded-[20px] bg-brand-beige p-6 text-stone-custom shadow-[0_24px_48px_rgba(0,0,0,.35)] md:mt-0 md:w-[360px] md:-rotate-2"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <Image
                src="/images/darkstone_logo_128px_bg.webp"
                alt=""
                width={36}
                height={36}
                quality={60}
                sizes="36px"
                className="shrink-0 rounded-full"
              />
              <span className="text-[15px] font-bold tracking-tight">{tc("brand")}</span>
            </span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-brand-orange-text">{tc("badge")}</span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[22px] leading-tight font-bold">
              {firstName} {lastName}
            </span>
            <span className="font-mono text-sm text-stone-custom/70">{memberNumber}</span>
          </span>
          <span className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand-orange-text md:min-h-0">
            {t("home.open_card")}
            <MdArrowForward aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}
