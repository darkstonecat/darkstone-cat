"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdDeleteOutline, MdFileDownload, MdVpnKey } from "react-icons/md";
import { exportProfileData } from "@/lib/profile/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import DeleteAccountDialog from "./DeleteAccountDialog";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-brand-white px-5 text-sm font-semibold transition-colors disabled:opacity-50 max-sm:w-full";

type AccountActionsProps = {
  email: string;
  memberNumber: string;
};

/** "Compte": change password (reuses the recovery email flow), download my data, delete account. */
export default function AccountActions({ email, memberNumber }: AccountActionsProps) {
  const t = useTranslations("profile.details");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [exportError, setExportError] = useState(false);

  async function handlePassword() {
    if (password === "sending") return;
    setPassword("sending");
    // Same flow as /forgot-password: a recovery link that opens /auth/callback -> /reset-password.
    const { error } = await createClient()
      .auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback` })
      .catch(() => ({ error: new Error("failed") }));
    setPassword(error ? "error" : "sent");
  }

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    const { data, error } = await exportProfileData().catch(() => ({ data: null, error: "failed" }));
    setExporting(false);
    if (error || !data) {
      setExportError(true);
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `darkstone-data-${memberNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePassword}
          disabled={password === "sending"}
          className={cn(BUTTON, "border-stone-custom/15 text-stone-custom hover:bg-stone-custom/5")}
        >
          <MdVpnKey aria-hidden="true" className="size-[18px]" />
          {t("change_password")}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className={cn(BUTTON, "border-stone-custom/15 text-stone-custom hover:bg-stone-custom/5")}
        >
          <MdFileDownload aria-hidden="true" className="size-[18px]" />
          {exporting ? t("download_generating") : t("download_data")}
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className={cn(BUTTON, "border-brand-red/35 text-brand-red hover:bg-brand-red/5")}
        >
          <MdDeleteOutline aria-hidden="true" className="size-[18px]" />
          {t("delete_account")}
        </button>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {password === "sent" && (
          <p role="status" className="text-[13px] text-stone-custom/65">
            {t("change_password_sent")}
          </p>
        )}
        {password === "error" && (
          <p role="alert" className="text-[13px] font-medium text-brand-red">
            {t("change_password_error")}
          </p>
        )}
        {exportError && (
          <p role="alert" className="text-[13px] font-medium text-brand-red">
            {t("download_error")}
          </p>
        )}
      </div>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}
