import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdArrowForward } from "react-icons/md";
import { Link } from "@/i18n/routing";
import MemberHeader from "./MemberHeader";

type HomeHeroProps = {
  firstName: string;
  lastName: string;
  memberNumber: string;
  membershipStartDate: string | null;
};

/** Header of "La meva zona": greeting plus the mini card linking to the full card. */
export default function HomeHero({
  firstName,
  lastName,
  memberNumber,
  membershipStartDate,
}: HomeHeroProps) {
  const t = useTranslations("profile");
  const tc = useTranslations("profile.card");

  return (
    <MemberHeader
      title={t("home.greeting", { name: firstName })}
      memberNumber={memberNumber}
      membershipStartDate={membershipStartDate}
      active="home"
      aside={
        <Link
          href="/profile/card"
          className="group flex w-full shrink-0 flex-col gap-[18px] rounded-[20px] bg-brand-beige p-6 text-stone-custom shadow-[0_24px_48px_rgba(0,0,0,.35)] md:w-[360px] md:-rotate-2"
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
              <span className="text-[15px] font-bold tracking-tight">
                {tc("brand")}
              </span>
            </span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-brand-orange-text">
              {tc("badge")}
            </span>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[22px] leading-tight font-bold">
              {firstName} {lastName}
            </span>
            <span className="font-mono text-sm text-stone-custom/70">
              {memberNumber}
            </span>
          </span>
          <span className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand-orange-text md:min-h-0">
            {t("home.open_card")}
            <MdArrowForward
              aria-hidden="true"
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </Link>
      }
    />
  );
}
