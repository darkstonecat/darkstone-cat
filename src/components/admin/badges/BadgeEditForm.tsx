"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { updateBadge } from "@/lib/admin/badge-actions";
import {
  BADGE_NAME_MAX,
  BADGE_SORT_ORDER_MAX,
  BADGE_TEXT_MAX,
  type AdminBadgeRow,
  type BadgePatch,
} from "@/lib/admin/badges";
import { BADGE_ICON_KEYS, localize, type BadgeIconKey, type LocalizedText } from "@/lib/badges/catalogue";
import { BADGE_ICONS } from "@/components/badges/badgeIcons";
import { cn } from "@/lib/utils";
import { adminButtonClass } from "../adminButtons";
import { INPUT_CLASS, TEXTAREA_CLASS } from "../member-file/errors";
import BadgeCircle from "./BadgeCircle";
import { BADGE_LOCALES, CARD, CHIP, badgeErrorKey, hasLanguage, type BadgeLocale } from "./shared";

type TextField = "name" | "earned" | "locked";
type Texts = Record<TextField, Record<BadgeLocale, string>>;

const TEXT_FIELDS: readonly TextField[] = ["name", "earned", "locked"];
const PATCH_KEY = { name: "name", earned: "earnedText", locked: "lockedText" } as const;
const MAX = { name: BADGE_NAME_MAX, earned: BADGE_TEXT_MAX, locked: BADGE_TEXT_MAX } as const;
const ORDER_RE = /^-?\d{1,6}$/;

function textsOf(badge: AdminBadgeRow): Texts {
  const pick = (text: LocalizedText) => ({ ca: text?.ca ?? "", es: text?.es ?? "", en: text?.en ?? "" });
  return { name: pick(badge.name), earned: pick(badge.earned_text), locked: pick(badge.locked_text) };
}

/** As the server stores it: trimmed, a blank es / en left out. */
function normalise(text: Record<BadgeLocale, string>): LocalizedText {
  const out: LocalizedText = { ca: text.ca.trim() };
  for (const locale of ["es", "en"] as const) {
    const value = text[locale].trim();
    if (value) out[locale] = value;
  }
  return out;
}

function sameText(a: LocalizedText, b: LocalizedText): boolean {
  return a.ca === b.ca && (a.es ?? "") === (b.es ?? "") && (a.en ?? "") === (b.en ?? "");
}

type BadgeEditFormProps = {
  badge: AdminBadgeRow;
  /** After a successful save (the page shows the notice and refreshes). */
  onSaved: () => void;
  /** Rendered under the preview, in the side column (the holders card). */
  aside?: ReactNode;
  /** Rendered above the form fields of an archived badge (the "Restaura" action). */
  archivedActions?: ReactNode;
};

/**
 * Edit card of a badge page (S7.3) with its live preview "Com la veu el soci". Texts per
 * language (Catalan required; an orange dot marks a language without text), icon picker,
 * "Mostra-la bloquejada" switch and order. "Desa" sends only the changed fields. An archived
 * badge is read-only.
 */
export default function BadgeEditForm({ badge, onSaved, aside, archivedActions }: BadgeEditFormProps) {
  const t = useTranslations("admin.badges");
  const locale = useLocale();
  const router = useRouter();
  const archived = Boolean(badge.archived_at);

  const [texts, setTexts] = useState<Texts>(() => textsOf(badge));
  const [icon, setIcon] = useState<BadgeIconKey>(badge.icon);
  const [showLocked, setShowLocked] = useState(badge.show_locked);
  const [order, setOrder] = useState(String(badge.sort_order));
  const [lang, setLang] = useState<BadgeLocale>("ca");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tabRefs = useRef<Record<BadgeLocale, HTMLButtonElement | null>>({ ca: null, es: null, en: null });

  const base = useId();
  const id = (part: string) => `${base}-${part}`;

  const original = textsOf(badge);
  const patch: BadgePatch = {};
  for (const field of TEXT_FIELDS) {
    const next = normalise(texts[field]);
    if (!sameText(next, normalise(original[field]))) patch[PATCH_KEY[field]] = next;
  }
  if (icon !== badge.icon) patch.icon = icon;
  if (showLocked !== badge.show_locked) patch.showLocked = showLocked;
  const orderText = order.trim();
  const orderValid = ORDER_RE.test(orderText) && Math.abs(Number(orderText)) <= BADGE_SORT_ORDER_MAX;
  if (orderValid && Number(orderText) !== badge.sort_order) patch.sortOrder = Number(orderText);

  const caMissing = TEXT_FIELDS.some((field) => texts[field].ca.trim() === "");
  // Anything typed, even what would not change the stored value (spaces, an invalid order).
  const dirty =
    JSON.stringify(texts) !== JSON.stringify(original) ||
    icon !== badge.icon ||
    showLocked !== badge.show_locked ||
    order !== String(badge.sort_order);
  const blockReason = caMissing ? t("edit.ca_required") : !orderValid ? t("edit.order_invalid") : "";
  const canSave = !busy && !blockReason && Object.keys(patch).length > 0;

  function setText(field: TextField, value: string) {
    setTexts((prev) => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  }

  function discard() {
    setTexts(textsOf(badge));
    setIcon(badge.icon);
    setShowLocked(badge.show_locked);
    setOrder(String(badge.sort_order));
    setError("");
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateBadge(badge.key, patch);
      if ("error" in result) {
        setError(t(badgeErrorKey(result.error)));
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setError(t("errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = BADGE_LOCALES.indexOf(lang);
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!move) return;
    event.preventDefault();
    const next = BADGE_LOCALES[(index + move + BADGE_LOCALES.length) % BADGE_LOCALES.length];
    setLang(next);
    tabRefs.current[next]?.focus();
  }

  // The preview shows what members of the tab's language would read (Catalan when blank).
  const shown = (field: TextField) => texts[field][lang].trim() || texts[field].ca.trim();

  const fieldLabel = (field: TextField, label: string) => (
    <label htmlFor={id(field)} className="text-sm font-semibold text-stone-custom">
      {label} {lang === "ca" && <span aria-hidden="true" className="text-brand-red">*</span>}
    </label>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
      <section aria-labelledby={id("title")} className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id={id("title")} className="text-xl font-bold break-words text-stone-custom">
            {localize(badge.name, locale)}
          </h2>
          <span className={`${CHIP} bg-stone-custom/7 font-mono text-stone-custom/80`}>
            {t("edit.key_chip", { key: badge.key })}
          </span>
        </div>
        {archived && archivedActions}

        <div
          role="tablist"
          aria-label={t("edit.lang_label")}
          className="inline-flex w-fit gap-1 rounded-xl bg-stone-custom/6 p-1"
        >
          {BADGE_LOCALES.map((tab) => {
            const missing = !hasLanguage(texts, tab);
            const selected = tab === lang;
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
                {t(`edit.lang_${tab}`)}
                {missing && (
                  <>
                    <span aria-hidden="true" className="ml-1.5 inline-block size-1.5 rounded-full bg-brand-orange" />
                    <span className="sr-only"> {t("edit.lang_missing")}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <fieldset disabled={archived || busy} className="flex min-w-0 flex-col gap-4">
          <div role="tabpanel" id={id("panel")} aria-labelledby={id(`tab-${lang}`)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              {fieldLabel("name", t("edit.name_label"))}
              <input
                id={id("name")}
                maxLength={MAX.name}
                value={texts.name[lang]}
                onChange={(event) => setText("name", event.target.value)}
                aria-describedby={id("name-hint")}
                className={INPUT_CLASS}
              />
              <p id={id("name-hint")} className="text-[13px] text-stone-custom/65">
                {t("edit.name_hint")}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {fieldLabel("earned", t("edit.earned_label"))}
              <textarea
                id={id("earned")}
                rows={2}
                maxLength={MAX.earned}
                value={texts.earned[lang]}
                onChange={(event) => setText("earned", event.target.value)}
                className={TEXTAREA_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {fieldLabel("locked", t("edit.locked_label"))}
              <textarea
                id={id("locked")}
                rows={2}
                maxLength={MAX.locked}
                value={texts.locked[lang]}
                onChange={(event) => setText("locked", event.target.value)}
                aria-describedby={id("fallback")}
                className={TEXTAREA_CLASS}
              />
              <p id={id("fallback")} className="text-[13px] text-stone-custom/65">
                {t("edit.fallback_hint")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span id={id("icon-legend")} className="text-sm font-semibold text-stone-custom">
              {t("edit.icon_label")}
            </span>
            <div role="group" aria-labelledby={id("icon-legend")} className="grid grid-cols-[repeat(auto-fill,44px)] gap-2">
              {BADGE_ICON_KEYS.map((key) => {
                const Icon = BADGE_ICONS[key];
                const pressed = key === icon;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={pressed}
                    aria-label={t(`edit.icons.${key}`)}
                    onClick={() => setIcon(key)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      pressed
                        ? "border-stone-custom bg-stone-custom text-brand-orange-light"
                        : "border-stone-custom/15 bg-brand-white text-stone-custom enabled:hover:bg-stone-custom/5",
                    )}
                  >
                    <Icon aria-hidden="true" size={22} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <button
              type="button"
              role="switch"
              aria-checked={showLocked}
              aria-labelledby={id("switch-label")}
              aria-describedby={id("switch-hint")}
              onClick={() => setShowLocked((value) => !value)}
              className="flex min-h-11 shrink-0 items-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative h-7 w-[46px] rounded-full transition-colors",
                  showLocked ? "bg-stone-custom" : "bg-stone-custom/25",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-[22px] rounded-full bg-brand-white transition-[left]",
                    showLocked ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </span>
            </button>
            <div className="pt-2.5">
              <p id={id("switch-label")} className="text-sm font-semibold text-stone-custom">
                {t("edit.switch_label")}
              </p>
              <p id={id("switch-hint")} className="text-[13px] text-stone-custom/65">
                {t("edit.switch_hint")}
              </p>
            </div>
          </div>

          <div className="flex max-w-[200px] flex-col gap-1.5">
            <label htmlFor={id("order")} className="text-sm font-semibold text-stone-custom">
              {t("edit.order_label")}
            </label>
            <input
              id={id("order")}
              type="number"
              inputMode="numeric"
              step={1}
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              aria-invalid={!orderValid || undefined}
              aria-describedby={id("order-hint")}
              className={INPUT_CLASS}
            />
            <p id={id("order-hint")} className="text-[13px] text-stone-custom/65">
              {t("edit.order_hint")}
            </p>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-brand-red">
            {error}
          </p>
        )}

        {!archived && (
          <div className="flex flex-col gap-2 border-t border-stone-custom/10 pt-4">
            {blockReason && (
              <p id={id("block")} className="text-[13px] text-stone-custom/65 sm:text-right">
                {blockReason}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={discard}
                disabled={busy || !dirty}
                className={adminButtonClass("secondary")}
              >
                {t("edit.discard")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                aria-describedby={blockReason ? id("block") : undefined}
                className={adminButtonClass("primary")}
              >
                {busy ? t("edit.saving") : t("edit.save")}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <section aria-labelledby={id("preview")} className={CARD}>
          <h2 id={id("preview")} className="text-xl font-bold text-stone-custom">
            {t("preview.title")}
          </h2>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 lg:max-xl:grid-cols-1">
            <div className="flex flex-col items-center gap-2.5 rounded-xl bg-brand-beige px-3.5 py-5 text-center">
              <span className="text-[11px] font-bold tracking-[0.12em] text-stone-custom/65 uppercase">
                {t("preview.earned")}
              </span>
              <BadgeCircle icon={icon} size="lg" />
              <span className="font-bold break-words text-stone-custom">{shown("name")}</span>
              <span className="text-[13px] break-words text-stone-custom/65">{shown("earned")}</span>
            </div>
            <div className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-stone-custom/20 px-3.5 py-5 text-center">
              <span className="text-[11px] font-bold tracking-[0.12em] text-stone-custom/65 uppercase">
                {t("preview.locked")}
              </span>
              {showLocked ? (
                <>
                  <BadgeCircle icon={icon} size="lg" look="locked" />
                  <span className="font-bold break-words text-stone-custom/65">{shown("name")}</span>
                  <span className="text-[13px] break-words text-stone-custom/65">{shown("locked")}</span>
                </>
              ) : (
                <span className="my-auto text-[13px] text-stone-custom/65">{t("preview.hidden")}</span>
              )}
            </div>
          </div>
          <p className="text-[13px] text-stone-custom/65">{t("preview.hint")}</p>
        </section>
        {aside}
      </div>
    </div>
  );
}
