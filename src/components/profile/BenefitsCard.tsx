import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdOpenInNew } from "react-icons/md";
import { cn } from "@/lib/utils";
import type { BenefitView } from "@/lib/benefits/view";
import CopyCodeButton from "./CopyCodeButton";

/**
 * "Beneficis per ser soci": perks for active members (logo, text, discount code, shop link).
 * Member home (`/profile`), the last section after the badges; nothing when there are no benefits.
 */
export default function BenefitsCard({ benefits }: { benefits: BenefitView[] }) {
  const t = useTranslations("profile.home");
  if (benefits.length === 0) return null;

  return (
    <section aria-labelledby="benefits-title" className="rounded-2xl bg-brand-white p-5 sm:p-8">
      <h2 id="benefits-title" className="text-[22px] font-bold text-stone-custom">
        {t("benefits_title")}
      </h2>
      <p className="mt-1 mb-5 text-sm text-stone-custom/65">{t("benefits_intro")}</p>

      <ul className="flex flex-col gap-4">
        {benefits.map((benefit) => (
          <li
            key={benefit.id}
            className="flex flex-col gap-4 rounded-xl border border-stone-custom/10 p-4 sm:flex-row sm:items-start"
          >
            {benefit.logo && (
              <div
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg"
                style={{ backgroundColor: benefit.logo.background ?? "#F5F5F4" }}
              >
                <Image
                  src={benefit.logo.src}
                  alt={benefit.logo.name}
                  fill
                  sizes="96px"
                  quality={60}
                  className={cn("object-contain p-2", benefit.logo.invert && "brightness-0 invert")}
                />
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div>
                <h3 className="text-lg font-bold text-stone-custom">{benefit.name}</h3>
                {benefit.description && (
                  <p className="mt-1 text-sm text-stone-custom/80">{benefit.description}</p>
                )}
              </div>

              {benefit.code && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-stone-custom/65">{t("benefits_code_label")}</span>
                  <code className="rounded-lg bg-brand-beige px-3 py-2 font-mono text-base font-bold tracking-wider text-stone-custom">
                    {benefit.code}
                  </code>
                  <CopyCodeButton code={benefit.code} label={benefit.name} />
                </div>
              )}

              <a
                href={benefit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 font-semibold text-brand-orange-text underline underline-offset-4 transition-colors hover:text-brand-orange"
              >
                {t("benefits_visit", { name: benefit.name })}
                <MdOpenInNew aria-hidden="true" />
                <span className="sr-only">{t("benefits_new_tab")}</span>
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
