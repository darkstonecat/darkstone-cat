"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { MdAdd } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import type { AdminBenefitRow } from "@/lib/admin/benefits";
import { localize } from "@/lib/badges/catalogue";
import { collaboratorLogo } from "@/lib/benefits/view";
import { cn } from "@/lib/utils";
import { adminButtonClass } from "../adminButtons";
import Notice from "../Notice";
import BenefitFormDialog from "./BenefitFormDialog";
import BenefitStateDialog, { type BenefitStateAction } from "./BenefitStateDialog";
import { BENEFIT_LOCALES, CARD, CHIP, META, benefitHasLanguage } from "./shared";

type Outcome = "created" | "updated" | "archive" | "restore";

const ROW = "grid grid-cols-[56px_1fr] gap-x-4 gap-y-3 border-t border-stone-custom/10 py-4 first:border-t-0 sm:grid-cols-[56px_1fr_auto]";

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function Logo({ collaboratorId }: { collaboratorId: string | null }) {
  const logo = collaboratorLogo(collaboratorId);
  return (
    <div
      className="relative size-14 overflow-hidden rounded-lg"
      style={{ backgroundColor: logo?.background ?? "#F5F5F4" }}
    >
      {logo && (
        <Image
          src={logo.src}
          alt=""
          fill
          sizes="56px"
          quality={60}
          className={cn("object-contain p-1.5", logo.invert && "brightness-0 invert")}
        />
      )}
    </div>
  );
}

/**
 * V-9 member benefits (odd/tasks/member-benefits.md S7): active benefits with "Nou benefici",
 * "Edita" and "Arxiva"; archived ones greyed with "Edita" and "Restaura". The discount codes are
 * shown here because the board manages them.
 */
export default function BenefitList({ benefits, loadError }: { benefits: AdminBenefitRow[]; loadError: boolean }) {
  const t = useTranslations("admin.benefits");
  const locale = useLocale();
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [formTarget, setFormTarget] = useState<AdminBenefitRow | "new" | null>(null);
  const [pending, setPending] = useState<{ action: BenefitStateAction; benefit: AdminBenefitRow } | null>(null);

  const active = benefits.filter((b) => !b.archived_at);
  const archived = benefits.filter((b) => b.archived_at);

  function done(result: Outcome) {
    setFormTarget(null);
    setPending(null);
    setOutcome(result);
    router.refresh();
  }

  function languages(benefit: AdminBenefitRow) {
    const present = BENEFIT_LOCALES.filter((l) =>
      benefitHasLanguage({ name: benefit.name, description: benefit.description }, l),
    );
    return present.length === 1 ? t("only_ca") : present.join(" · ");
  }

  function row(benefit: AdminBenefitRow, isArchived: boolean) {
    const name = localize(benefit.name, locale);
    return (
      <li key={benefit.id} className={cn(ROW, isArchived && "opacity-70")}>
        <Logo collaboratorId={benefit.collaborator_id} />
        <div className="min-w-0">
          <p className="font-bold break-words text-stone-custom">{name}</p>
          <p className="text-[13px] text-stone-custom/65">{localize(benefit.description, locale)}</p>
          <p className={`${META} mt-1`}>
            {benefit.discount_code ? (
              <span className={`${CHIP} bg-stone-custom/7 font-mono text-stone-custom/80`}>
                {t("code_chip", { code: benefit.discount_code })}
              </span>
            ) : (
              <span>{t("no_code")}</span>
            )}
            <a href={benefit.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {host(benefit.url)}
            </a>
            <span>{languages(benefit)}</span>
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setFormTarget(benefit);
            }}
            className={adminButtonClass("secondary")}
            aria-label={t("edit_label", { name })}
          >
            {t("edit_button")}
          </button>
          <button
            type="button"
            onClick={() => {
              setOutcome(null);
              setPending({ action: isArchived ? "restore" : "archive", benefit });
            }}
            className={adminButtonClass("secondary")}
            aria-label={t(isArchived ? "restore_label" : "archive_label", { name })}
          >
            {t(isArchived ? "restore_button" : "archive_button")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 md:pt-16">
      {outcome && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{t(`${outcome}_done`)}</p>
          </Notice>
        </div>
      )}
      {loadError && (
        <Notice kind="blocked">
          <p>{t("load_error")}</p>
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="benefits-active" className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="benefits-active" className="text-xl font-bold text-stone-custom">
                  {t("active_title")}
                </h2>
                <p className="text-[13px] text-stone-custom/65">{t("active_summary", { count: active.length })}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOutcome(null);
                  setFormTarget("new");
                }}
                className={adminButtonClass("primary", "gap-2")}
              >
                <MdAdd aria-hidden="true" className="size-5" />
                {t("new_button")}
              </button>
            </div>
            {active.length > 0 ? (
              <ul className="flex flex-col">{active.map((b) => row(b, false))}</ul>
            ) : (
              !loadError && <p className="text-sm text-stone-custom/65">{t("empty")}</p>
            )}
          </section>

          {archived.length > 0 && (
            <section aria-labelledby="benefits-archived" className={CARD}>
              <h2 id="benefits-archived" className="text-xl font-bold text-stone-custom">
                {t("archived_title")}
              </h2>
              <ul className="flex flex-col">{archived.map((b) => row(b, true))}</ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="benefits-help" className={CARD}>
          <h2 id="benefits-help" className="text-lg font-bold text-stone-custom">
            {t("help_title")}
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-stone-custom/80">
            <li>{t("help_where")}</li>
            <li>{t("help_code")}</li>
            <li>{t("help_logo")}</li>
            <li>{t("help_archive")}</li>
          </ul>
        </aside>
      </div>

      <BenefitFormDialog target={formTarget} onClose={() => setFormTarget(null)} onDone={done} />
      <BenefitStateDialog pending={pending} onClose={() => setPending(null)} onDone={done} />
    </div>
  );
}
