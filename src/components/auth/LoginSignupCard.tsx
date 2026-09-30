import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdCheck, MdArrowForward } from "react-icons/md";
import { Link } from "@/i18n/routing";

export default function LoginSignupCard() {
  const t = useTranslations("auth");

  return (
    <aside className="flex flex-col overflow-hidden rounded-2xl bg-stone-custom text-brand-white">
      <Image
        src="/images/photos/activities_boardgames.webp"
        alt={t("login_cta_image_alt")}
        width={800}
        height={400}
        quality={60}
        sizes="(min-width: 1088px) 520px, (min-width: 768px) 45vw, 100vw"
        className="h-[140px] w-full object-cover opacity-85 md:h-[180px]"
      />
      <div className="flex flex-col gap-[18px] p-6 md:p-8">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight">
          {t("login_cta_title")}
        </h2>
        <p className="text-[15px] leading-relaxed text-brand-white/70">
          {t("login_cta_text")}
        </p>
        <ul className="flex flex-col gap-2">
          {(["login_cta_card", "login_cta_agenda"] as const).map((key) => (
            <li
              key={key}
              className="flex items-center gap-2.5 text-sm text-brand-white/85"
            >
              <MdCheck
                size={18}
                aria-hidden="true"
                className="shrink-0 text-brand-orange-light"
              />
              {t(key)}
            </li>
          ))}
        </ul>
        <Link
          href="/register"
          className="mt-1.5 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-brand-orange px-7 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-orange/90"
        >
          {t("login_cta_button")}
          <MdArrowForward size={16} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
