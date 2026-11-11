import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

/** "Com funciona" card of the /events sidebar. */
export default function HowItWorks() {
  const t = useTranslations("events");
  return (
    <section aria-labelledby="events-how-title" className="flex flex-col gap-2.5 rounded-[20px] bg-stone-custom p-[18px] text-stone-white-hover">
      <h2 id="events-how-title" className="text-base font-bold">{t("how_title")}</h2>
      <ol className="flex list-decimal flex-col gap-1.5 pl-[18px] text-sm leading-relaxed text-stone-white-base">
        <li>{t("how_step_1")}</li>
        <li>{t("how_step_2")}</li>
        <li>{t("how_step_3")}</li>
      </ol>
      <Link href="/faq" className="text-sm font-bold text-brand-orange-light hover:underline">
        {t("how_faq")}&nbsp;<span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
