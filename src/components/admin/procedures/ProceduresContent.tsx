import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";
import { PROCEDURES, type ProcedureDef } from "./procedures";

const NESTED_SUFFIX = ["a", "b", "c", "d"] as const;

/** Rich-text tags of the procedure copy: `<b>` emphasis and `<p1>P-1</p1>` cross-references. */
const RICH = {
  b: (chunks: ReactNode) => <strong className="font-semibold">{chunks}</strong>,
  p1: (chunks: ReactNode) => (
    <a href="#p-1" className="text-brand-orange-text underline">
      {chunks}
    </a>
  ),
};

/** V-8: index of the procedures and one card per procedure. Pure copy, no data. */
export default function ProceduresContent() {
  const t = useTranslations("admin.procedures");

  return (
    <div className="mx-auto max-w-[1120px] px-4 pt-10 sm:px-6 md:pt-16">
      <p className="mb-8 text-base text-stone-custom/75">{t("intro")}</p>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        <nav
          aria-label={t("index_aria")}
          className="rounded-2xl bg-brand-white p-4 md:p-6 lg:sticky lg:top-24"
        >
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-stone-custom/65 uppercase">
            {t("index_label")}
          </p>
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
            {PROCEDURES.map(({ n }) => (
              <li key={n} className="shrink-0">
                <a
                  href={`#p-${n}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg text-sm text-stone-custom hover:underline"
                >
                  <span className="rounded-full bg-brand-orange/12 px-2.5 py-1 text-xs font-bold text-brand-orange-text">
                    P-{n}
                  </span>
                  <span className="hidden lg:inline">{t(`p${n}.title`)}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-6">
          {PROCEDURES.map((procedure) => (
            <ProcedureCard key={procedure.n} procedure={procedure} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcedureCard({ procedure }: { procedure: ProcedureDef }) {
  const t = useTranslations("admin.procedures");
  const { n, steps, actionHref } = procedure;
  const titleId = `p-${n}-title`;

  return (
    <article
      id={`p-${n}`}
      aria-labelledby={titleId}
      className="flex scroll-mt-24 flex-col gap-[18px] rounded-2xl bg-brand-white p-5 md:p-8"
    >
      <div>
        <p className="text-xs font-bold tracking-[0.2em] text-brand-orange-text uppercase">P-{n}</p>
        <h2 id={titleId} tabIndex={-1} className="mt-1 text-[22px] font-bold outline-none">
          {t(`p${n}.title`)}
        </h2>
      </div>

      <ol className="flex flex-col gap-3.5">
        {steps.map((step, index) => {
          const s = `p${n}.s${index + 1}`;
          if (step.warning) {
            return (
              <li key={s}>
                <Notice kind="warning">{t.rich(s, RICH)}</Notice>
              </li>
            );
          }
          return (
            <li key={s} className="grid grid-cols-[28px_1fr] gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-stone-custom/7 text-xs font-bold"
              >
                {index + 1}
              </span>
              <div className="text-[15px] leading-relaxed">
                {t.rich(s, RICH)}
                {step.legal && (
                  <span className="text-xs text-stone-custom/65"> ({t(`${s}_legal`)})</span>
                )}
                {step.nested ? (
                  <ul className={cn("mt-2 flex flex-col gap-1.5 border-l-2 border-stone-custom/15 pl-3")}>
                    {NESTED_SUFFIX.slice(0, step.nested).map((suffix) => (
                      <li key={suffix}>{t.rich(`${s}_${suffix}`, RICH)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-3 border-t border-stone-custom/10 pt-4 sm:flex-row sm:items-center">
        <span className="text-[13px] font-semibold text-stone-custom/65">{t("action_label")}</span>
        <Link href={actionHref} className={adminButtonClass("secondary", "max-sm:w-full")}>
          {t(`p${n}.action`)}
        </Link>
      </div>
    </article>
  );
}
