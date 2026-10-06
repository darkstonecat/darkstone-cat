"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MdFileDownload } from "react-icons/md";
import { Link } from "@/i18n/routing";
import AdminDialog from "@/components/admin/AdminDialog";
import { adminButtonClass } from "@/components/admin/adminButtons";
import { leaveAssociation, type LeaveAssociationError } from "@/lib/profile/leave-actions";

/** `member_leave_self` counts 500 code points. */
const MAX_REASON = 500;

type LeaveAssociationDialogProps = {
  open: boolean;
  onClose: () => void;
  memberNumber: string;
  /** "Descarrega les meves dades" (the same export as the Compte card). */
  onDownload: () => void;
  downloading: boolean;
};

/**
 * Deletes the Supabase auth cookies of this browser (plain and chunked), like the NavBar sign-out.
 * The leave already deleted every session in the database and the server action cleared the
 * cookies it could; this covers a browser where that answer did not arrive.
 */
function wipeAuthCookies() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;
  const projectRef = new URL(url).hostname.split(".")[0];
  const key = `sb-${projectRef}-auth-token`;
  const expire = "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = `${key}${expire}`;
  for (let i = 0; i < 10; i++) document.cookie = `${key}.${i}${expire}`;
}

const ERROR_KEYS: Record<LeaveAssociationError, string> = {
  role_held: "leave_error_role_held",
  reason_too_long: "leave_error_reason_too_long",
  unauthenticated: "leave_error_session",
  invalid: "leave_error_generic",
  not_active: "leave_error_generic",
  failed: "leave_error_generic",
};

/**
 * M-1 · Dona't de baixa (spec §7.1, mockup 09 "M-1"). Closes the caller's own membership with
 * `leaveAssociation`: the account is banned, not deleted. On success the browser is signed out
 * and sent to /login with the "T'has donat de baixa" notice.
 */
export default function LeaveAssociationDialog({
  open,
  onClose,
  memberNumber,
  onDownload,
  downloading,
}: LeaveAssociationDialogProps) {
  const t = useTranslations("profile.details");
  const locale = useLocale();
  const [understood, setUnderstood] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const checkboxId = useId();
  const reasonId = useId();
  const reasonHintId = useId();

  function handleClose() {
    if (busy) return;
    setUnderstood(false);
    setReason("");
    setError(undefined);
    onClose();
  }

  async function handleConfirm() {
    if (busy || !understood) return;
    setBusy(true);
    setError(undefined);
    let result: Awaited<ReturnType<typeof leaveAssociation>>;
    try {
      result = await leaveAssociation(reason.trim() || null);
    } catch {
      result = { error: "failed" };
    }
    if ("error" in result) {
      setError(t(ERROR_KEYS[result.error] ?? "leave_error_generic"));
      setBusy(false);
      return;
    }

    wipeAuthCookies();
    // A full reload drops all client auth state at once; the default locale has no prefix.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${locale === "ca" ? "" : `/${locale}`}/login?left=1`;
  }

  return (
    <AdminDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t("leave_title")}
      target={t("leave_target", { number: memberNumber })}
      variant="danger"
      confirmLabel={busy ? t("leave_confirming") : t("leave_confirm")}
      confirmDisabled={!understood}
      confirmDisabledReason={t("leave_checkbox_help")}
      busy={busy}
      error={error}
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-stone-custom">{t("leave_what_happens")}</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-normal text-stone-custom/85">
          <li>{t("leave_effect_sign_in")}</li>
          <li>{t("leave_effect_card")}</li>
          <li>{t("leave_effect_data")}</li>
          <li>{t("leave_effect_register")}</li>
          <li>{t("leave_effect_return")}</li>
        </ul>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-xl bg-stone-custom/[0.05] p-4 text-sm text-stone-custom/80">
        <p>{t("leave_download_hint")}</p>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy || downloading}
          className={adminButtonClass("secondary", "gap-2 max-sm:w-full")}
        >
          <MdFileDownload aria-hidden="true" className="size-[18px]" />
          {downloading ? t("download_generating") : t("download_data")}
        </button>
        <p>
          {t.rich("leave_erasure_hint", {
            link: (chunks) => (
              <Link href="/privacy" className="font-semibold text-brand-orange-text underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className="text-sm font-semibold text-stone-custom">
          {t("leave_reason_label")}
        </label>
        <textarea
          id={reasonId}
          rows={2}
          maxLength={MAX_REASON}
          disabled={busy}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-describedby={reasonHintId}
          className="w-full resize-y rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 py-3 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-50"
        />
        <p id={reasonHintId} className="text-[13px] text-stone-custom/65">
          {t("leave_reason_hint")}
        </p>
      </div>

      <label htmlFor={checkboxId} className="flex min-h-11 items-center gap-3 text-[15px] text-stone-custom">
        <input
          id={checkboxId}
          type="checkbox"
          data-autofocus
          checked={understood}
          disabled={busy}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="size-5 shrink-0 accent-brand-red"
        />
        <span>
          {t("leave_checkbox")} <span aria-hidden="true" className="text-brand-red">*</span>
        </span>
      </label>
    </AdminDialog>
  );
}
