"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createBadge } from "@/lib/admin/badge-actions";
import { BADGE_KEY_MAX, BADGE_NAME_MAX, BADGE_TEXT_MAX, isBadgeKey, suggestBadgeKey } from "@/lib/admin/badges";
import AdminDialog from "../AdminDialog";
import { INPUT_CLASS, TEXTAREA_CLASS } from "../member-file/errors";
import { badgeErrorKey } from "./shared";

type CreateBadgeDialogProps = { open: boolean; onClose: () => void };

const EMPTY = { name: "", key: "", earnedText: "", lockedText: "" };

/**
 * "Nova insígnia" (S7.4): Catalan name, key proposed from the name (editable until created),
 * the two Catalan texts. Creates it with the "star" icon and opens its page.
 */
export default function CreateBadgeDialog({ open, onClose }: CreateBadgeDialogProps) {
  const t = useTranslations("admin.badges");
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  // Once the key is typed by hand, the name stops proposing it.
  const [keyEdited, setKeyEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ids = { name: useId(), key: useId(), keyHint: useId(), keyError: useId(), earned: useId(), locked: useId() };

  const key = form.key.trim();
  const keyInvalid = key !== "" && !isBadgeKey(key);
  const complete =
    form.name.trim() !== "" && key !== "" && form.earnedText.trim() !== "" && form.lockedText.trim() !== "";

  function close() {
    if (busy) return;
    setForm(EMPTY);
    setKeyEdited(false);
    setError("");
    onClose();
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const result = await createBadge({
        key,
        name: form.name.trim(),
        earnedText: form.earnedText.trim(),
        lockedText: form.lockedText.trim(),
      });
      if ("error" in result) {
        setError(result.error === "invalid" && result.field === "key" ? t("create.key_invalid") : t(badgeErrorKey(result.error)));
        setBusy(false);
        return;
      }
      router.push(`/admin/badges/${result.key}`);
    } catch {
      setError(t("errors.failed"));
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={close}
      onConfirm={confirm}
      title={t("create.title")}
      confirmLabel={busy ? t("create.saving") : t("create.confirm")}
      confirmDisabled={!complete || keyInvalid}
      confirmDisabledReason={keyInvalid ? t("create.key_invalid") : t("create.disabled")}
      busy={busy}
      error={error || undefined}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-semibold text-stone-custom">
          {t("create.name_label")} <span aria-hidden="true" className="text-brand-red">*</span>
        </label>
        <input
          id={ids.name}
          data-autofocus
          required
          maxLength={BADGE_NAME_MAX}
          disabled={busy}
          value={form.name}
          onChange={(event) => {
            const name = event.target.value;
            setForm((prev) => ({ ...prev, name, key: keyEdited ? prev.key : suggestBadgeKey(name) }));
          }}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.key} className="text-sm font-semibold text-stone-custom">
          {t("create.key_label")} <span aria-hidden="true" className="text-brand-red">*</span>
        </label>
        <input
          id={ids.key}
          required
          maxLength={BADGE_KEY_MAX}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          value={form.key}
          aria-invalid={keyInvalid || undefined}
          aria-describedby={keyInvalid ? `${ids.keyHint} ${ids.keyError}` : ids.keyHint}
          onChange={(event) => {
            setKeyEdited(true);
            setForm((prev) => ({ ...prev, key: event.target.value }));
          }}
          className={`${INPUT_CLASS} font-mono`}
        />
        <p id={ids.keyHint} className="text-[13px] text-stone-custom/65">
          {t("create.key_hint")}
        </p>
        {keyInvalid && (
          <p id={ids.keyError} className="text-[13px] text-brand-red">
            {t("create.key_invalid")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.earned} className="text-sm font-semibold text-stone-custom">
          {t("create.earned_label")} <span aria-hidden="true" className="text-brand-red">*</span>
        </label>
        <textarea
          id={ids.earned}
          required
          rows={2}
          maxLength={BADGE_TEXT_MAX}
          disabled={busy}
          value={form.earnedText}
          onChange={(event) => setForm((prev) => ({ ...prev, earnedText: event.target.value }))}
          className={TEXTAREA_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.locked} className="text-sm font-semibold text-stone-custom">
          {t("create.locked_label")} <span aria-hidden="true" className="text-brand-red">*</span>
        </label>
        <textarea
          id={ids.locked}
          required
          rows={2}
          maxLength={BADGE_TEXT_MAX}
          disabled={busy}
          value={form.lockedText}
          onChange={(event) => setForm((prev) => ({ ...prev, lockedText: event.target.value }))}
          className={TEXTAREA_CLASS}
        />
      </div>
      <p className="text-[13px] text-stone-custom/65">{t("create.note")}</p>
    </AdminDialog>
  );
}
