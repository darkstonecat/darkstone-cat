"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MdVisibility } from "react-icons/md";
import { revealSensitive } from "@/lib/admin/member-actions";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";
import { TEXTAREA_CLASS, errorKey } from "./errors";

/** Mirrors `admin_reveal_reason_min_length()` and the 500-character cap; the server checks both. */
const FORMER_REASON_MIN = 10;
const REASON_MAX = 500;

type RevealButtonProps = {
  memberId: string;
  memberNumber: string;
  memberName: string;
  field: "dni" | "phone";
  /** Former member: only a superadmin gets this button (DNI only) and a reason of 10+ is required. */
  former: boolean;
};

/**
 * A-5 "Mostra". The decrypted value lives only in this component's state while the dialog is
 * open: it is cleared on close and never reaches the page, the URL or any storage.
 */
export default function RevealButton({ memberId, memberNumber, memberName, field, former }: RevealButtonProps) {
  const t = useTranslations("admin.member_file.reveal");
  const tErr = useTranslations("admin.member_file.errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const optionalReasonId = useId();

  function handleClose() {
    if (busy) return;
    setOpen(false);
    setReason("");
    setError("");
    setValue(null);
    setCopied(false);
  }

  async function handleReveal() {
    setBusy(true);
    setError("");
    try {
      const trimmed = reason.trim();
      const result = await revealSensitive(memberId, field, trimmed || null);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setValue(result.value);
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError("");
    } catch {
      setCopied(false);
      setError(t("copy_failed"));
    }
  }

  const shown = value !== null;
  const label = t(`field_${field}`);
  const triggerLabel = former ? t("button_former") : t("button");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("button_label", { field: label })}
        className={adminButtonClass("secondary", "gap-2 self-start")}
      >
        <MdVisibility aria-hidden="true" className="size-5" />
        {triggerLabel}
      </button>
      <AdminDialog
        open={open}
        onClose={handleClose}
        onConfirm={shown ? handleCopy : handleReveal}
        title={former ? t("title_former") : t("title", { field: label })}
        target={t("target", { number: memberNumber, name: memberName })}
        superadminOnly={former}
        confirmLabel={shown ? t("copy") : busy ? t("revealing") : t("confirm", { field: label })}
        cancelLabel={shown ? t("close") : undefined}
        busy={busy}
        error={error || undefined}
        reason={
          former && !shown
            ? {
                label: t("reason_label"),
                value: reason,
                onChange: setReason,
                minLength: FORMER_REASON_MIN,
                maxLength: REASON_MAX,
                help: t("reason_help"),
              }
            : undefined
        }
      >
        {former && !shown && <Notice kind="blocked">{t("blocked")}</Notice>}
        {!former && !shown && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={optionalReasonId} className="text-sm font-semibold text-stone-custom">
              {t("reason_optional_label")}
            </label>
            <textarea
              id={optionalReasonId}
              data-autofocus
              rows={2}
              maxLength={REASON_MAX}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={TEXTAREA_CLASS}
            />
            <p className="text-[13px] text-stone-custom/65">{t("reason_optional_help")}</p>
          </div>
        )}
        <div aria-live="polite" className="flex flex-col gap-2">
          {shown && (
            <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4">
              <p className="text-sm text-stone-custom/70">{t(`result_${field}`, { name: memberName })}</p>
              <p data-testid="revealed-value" className="break-all font-mono text-xl font-bold tracking-wider text-stone-custom">
                {value}
              </p>
              <p className="text-[13px] text-stone-custom/65">{t("only_here")}</p>
              {copied && <p className="text-[13px] font-semibold text-green-700">{t("copied")}</p>}
            </div>
          )}
        </div>
      </AdminDialog>
    </>
  );
}
