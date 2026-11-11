"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { createBenefit, updateBenefit } from "@/lib/admin/benefit-actions";
import {
  BENEFIT_CODE_MAX,
  BENEFIT_DESCRIPTION_MAX,
  BENEFIT_LOGOS,
  BENEFIT_NAME_MAX,
  BENEFIT_URL_MAX,
  type AdminBenefitRow,
  type BenefitField,
} from "@/lib/admin/benefits";
import { cn } from "@/lib/utils";
import AdminDialog from "../AdminDialog";
import { INPUT_CLASS, TEXTAREA_CLASS } from "../member-file/errors";
import { BENEFIT_LOCALES, benefitErrorKey, benefitHasLanguage, type BenefitLocale } from "./shared";

type Texts = Record<BenefitLocale, string>;
type Form = {
  name: Texts;
  description: Texts;
  url: string;
  discountCode: string;
  collaboratorId: string;
  sortOrder: string;
};

function texts(value: Partial<Record<BenefitLocale, string>> | undefined): Texts {
  return { ca: value?.ca ?? "", es: value?.es ?? "", en: value?.en ?? "" };
}

function initialForm(benefit: AdminBenefitRow | null): Form {
  return {
    name: texts(benefit?.name),
    description: texts(benefit?.description),
    url: benefit?.url ?? "https://",
    discountCode: benefit?.discount_code ?? "",
    collaboratorId: benefit?.collaborator_id ?? "",
    sortOrder: benefit ? String(benefit.sort_order) : "",
  };
}

type BenefitFormDialogProps = {
  /** null = closed; "new" = create; a row = edit that benefit. */
  target: AdminBenefitRow | "new" | null;
  onClose: () => void;
  onDone: (outcome: "created" | "updated") => void;
};

/**
 * "Nou benefici" / "Edita el benefici" (S7): name and description per language (Catalan
 * required), shop link, discount code, logo and, when editing, the order. The database checks
 * everything again and returns the fields that changed.
 */
export default function BenefitFormDialog({ target, onClose, onDone }: BenefitFormDialogProps) {
  const editing = target !== null && target !== "new" ? target : null;
  // Remounting per target resets the form without effects.
  return (
    <BenefitForm
      key={target === null ? "closed" : editing ? editing.id : "new"}
      open={target !== null}
      benefit={editing}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function BenefitForm({
  open,
  benefit,
  onClose,
  onDone,
}: {
  open: boolean;
  benefit: AdminBenefitRow | null;
  onClose: () => void;
  onDone: (outcome: "created" | "updated") => void;
}) {
  const t = useTranslations("admin.benefits");
  const [form, setForm] = useState<Form>(() => initialForm(benefit));
  const [lang, setLang] = useState<BenefitLocale>("ca");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [badField, setBadField] = useState<BenefitField | null>(null);
  const tabRefs = useRef<Partial<Record<BenefitLocale, HTMLButtonElement | null>>>({});
  const base = useId();
  const id = (part: string) => `${base}-${part}`;

  const complete = form.name.ca.trim() !== "" && form.description.ca.trim() !== "" && form.url.trim() !== "";

  function setText(field: "name" | "description", value: string) {
    setForm((current) => ({ ...current, [field]: { ...current[field], [lang]: value } }));
  }

  function close() {
    if (busy) return;
    onClose();
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const index = BENEFIT_LOCALES.indexOf(lang);
    const next = BENEFIT_LOCALES[(index + move + BENEFIT_LOCALES.length) % BENEFIT_LOCALES.length];
    setLang(next);
    tabRefs.current[next]?.focus();
  }

  async function submit() {
    setBusy(true);
    setError("");
    setBadField(null);
    const input = {
      name: form.name,
      description: form.description,
      url: form.url,
      discountCode: form.discountCode,
      collaboratorId: form.collaboratorId,
    };
    try {
      const result = benefit
        ? await updateBenefit(benefit.id, { ...input, sortOrder: Number(form.sortOrder.trim() || NaN) })
        : await createBenefit(input);
      if ("error" in result) {
        setBadField(result.field ?? null);
        setError(result.error === "invalid" && result.field ? t(`errors.field_${result.field}`) : t(benefitErrorKey(result.error)));
        return;
      }
      onDone(benefit ? "updated" : "created");
    } catch {
      setError(t("errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  const invalidProps = (field: BenefitField) => (badField === field ? { "aria-invalid": true as const } : {});

  return (
    <AdminDialog
      open={open}
      onClose={close}
      onConfirm={submit}
      title={benefit ? t("form.edit_title") : t("form.new_title")}
      confirmLabel={benefit ? t("form.save") : t("form.create")}
      cancelLabel={t("form.cancel")}
      confirmDisabled={!complete}
      confirmDisabledReason={t("form.incomplete")}
      busy={busy}
      error={error}
    >
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
        <div role="tablist" aria-label={t("form.lang_label")} className="inline-flex w-fit gap-1 rounded-xl bg-stone-custom/6 p-1">
          {BENEFIT_LOCALES.map((tab) => {
            const selected = tab === lang;
            const missing = !benefitHasLanguage(form, tab);
            return (
              <button
                key={tab}
                ref={(node) => {
                  tabRefs.current[tab] = node;
                }}
                id={id(`tab-${tab}`)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={id("panel")}
                tabIndex={selected ? 0 : -1}
                onClick={() => setLang(tab)}
                onKeyDown={onTabKey}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-[9px] px-3.5 text-sm font-semibold transition-colors",
                  selected ? "bg-brand-white text-stone-custom shadow-sm" : "text-stone-custom/65 hover:text-stone-custom",
                )}
              >
                {t(`form.lang_${tab}`)}
                {missing && (
                  <>
                    <span aria-hidden="true" className="ml-1.5 inline-block size-1.5 rounded-full bg-brand-orange" />
                    <span className="sr-only"> {t("form.lang_missing")}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={id("panel")} aria-labelledby={id(`tab-${lang}`)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("name")} className="text-sm font-semibold text-stone-custom">
              {t("form.name_label")} {lang === "ca" && <span aria-hidden="true" className="text-brand-red">*</span>}
            </label>
            <input
              id={id("name")}
              data-autofocus
              maxLength={BENEFIT_NAME_MAX}
              value={form.name[lang]}
              onChange={(event) => setText("name", event.target.value)}
              className={INPUT_CLASS}
              {...invalidProps("name")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("description")} className="text-sm font-semibold text-stone-custom">
              {t("form.description_label")} {lang === "ca" && <span aria-hidden="true" className="text-brand-red">*</span>}
            </label>
            <textarea
              id={id("description")}
              rows={2}
              maxLength={BENEFIT_DESCRIPTION_MAX}
              value={form.description[lang]}
              onChange={(event) => setText("description", event.target.value)}
              aria-describedby={id("fallback")}
              className={TEXTAREA_CLASS}
              {...invalidProps("description")}
            />
            <p id={id("fallback")} className="text-[13px] text-stone-custom/65">
              {t("form.fallback_hint")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("url")} className="text-sm font-semibold text-stone-custom">
            {t("form.url_label")} <span aria-hidden="true" className="text-brand-red">*</span>
          </label>
          <input
            id={id("url")}
            type="url"
            inputMode="url"
            maxLength={BENEFIT_URL_MAX}
            value={form.url}
            onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
            className={INPUT_CLASS}
            {...invalidProps("url")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("code")} className="text-sm font-semibold text-stone-custom">
              {t("form.code_label")}
            </label>
            <input
              id={id("code")}
              maxLength={BENEFIT_CODE_MAX}
              autoComplete="off"
              spellCheck={false}
              value={form.discountCode}
              onChange={(event) => setForm((current) => ({ ...current, discountCode: event.target.value }))}
              aria-describedby={id("code-hint")}
              className={cn(INPUT_CLASS, "font-mono")}
              {...invalidProps("discountCode")}
            />
            <p id={id("code-hint")} className="text-[13px] text-stone-custom/65">
              {t("form.code_hint")}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("logo")} className="text-sm font-semibold text-stone-custom">
              {t("form.logo_label")}
            </label>
            <select
              id={id("logo")}
              value={form.collaboratorId}
              onChange={(event) => setForm((current) => ({ ...current, collaboratorId: event.target.value }))}
              className={INPUT_CLASS}
              {...invalidProps("collaboratorId")}
            >
              <option value="">{t("form.logo_none")}</option>
              {BENEFIT_LOGOS.map((logo) => (
                <option key={logo.id} value={logo.id}>
                  {logo.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {benefit && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("order")} className="text-sm font-semibold text-stone-custom">
              {t("form.order_label")}
            </label>
            <input
              id={id("order")}
              type="number"
              step={1}
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              aria-describedby={id("order-hint")}
              className={cn(INPUT_CLASS, "w-32")}
              {...invalidProps("sortOrder")}
            />
            <p id={id("order-hint")} className="text-[13px] text-stone-custom/65">
              {t("form.order_hint")}
            </p>
          </div>
        )}
      </fieldset>
    </AdminDialog>
  );
}
