import { useTranslations } from "next-intl";
import { MdCheck } from "react-icons/md";
import { Link } from "@/i18n/routing";
import type { ChecklistStep } from "@/lib/profile/completion";
import { cn } from "@/lib/utils";

/** "Completa el perfil" card: vertical checklist with progress. Renders nothing when every step is done. */
export default function ProfileChecklist({ steps, className }: { steps: ChecklistStep[]; className?: string }) {
  const t = useTranslations("profile.home");
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section
      aria-labelledby="checklist-title"
      className={cn("flex flex-col gap-[18px] rounded-2xl bg-stone-custom p-5 text-brand-white md:p-7", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checklist-title" className="text-xl font-bold">
          {t("checklist_title")}
        </h2>
        <p className="text-sm font-bold text-brand-orange-light">{t("checklist_count", { done, total: steps.length })}</p>
      </div>
      <div
        role="progressbar"
        aria-label={t("checklist_title")}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        className="h-1.5 rounded-full bg-brand-white/12"
      >
        <div className="h-full rounded-full bg-brand-orange" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="flex flex-col gap-1 md:gap-3.5">
        {steps.map((step) => (
          <li key={step.key} className="flex min-h-11 items-center gap-3 md:min-h-0">
            {step.done ? (
              <>
                <span
                  aria-hidden="true"
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-orange"
                >
                  <MdCheck size={14} />
                </span>
                <span className="text-brand-white/65 line-through">
                  {t(`step_${step.key}`)}
                  <span className="sr-only"> ({t("step_done")})</span>
                </span>
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="size-[18px] shrink-0 rounded-full border-2 border-brand-white/35"
                />
                <Link
                  href={step.href}
                  className="inline-flex min-h-11 flex-1 items-center font-semibold text-brand-white underline underline-offset-2 md:min-h-0"
                >
                  {t(`step_${step.key}`)}
                </Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
