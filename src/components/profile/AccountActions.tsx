"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdFileDownload, MdLogout, MdVpnKey, MdWarningAmber } from "react-icons/md";
import { exportProfileData } from "@/lib/profile/actions";
import { requestPasswordReset } from "@/lib/supabase/password-reset-actions";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isBoardRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import LeaveAssociationDialog from "./LeaveAssociationDialog";
import LiveMessages from "./LiveMessages";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-brand-white px-5 text-sm font-semibold transition-colors aria-disabled:opacity-50 max-sm:w-full";

type AccountActionsProps = {
  email: string;
  memberNumber: string;
};

/**
 * "Compte": change password (the neutral recovery e-mail), download my data, and leave the
 * association (M-1). A member with a board role cannot leave until a superadmin removes the
 * role (BR-12): the button is disabled with the reason visible. The role read here only
 * drives the UI; the database refuses the leave of a role holder anyway (`role_held`).
 */
export default function AccountActions({ email, memberNumber }: AccountActionsProps) {
  const t = useTranslations("profile.details");
  const { role } = useAuthUser();
  const holdsRole = isBoardRole(role);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [exportError, setExportError] = useState(false);

  async function handlePassword() {
    if (password === "sending") return;
    setPassword("sending");
    // Same server action as /forgot-password: a recovery link that opens /auth/callback -> /reset-password.
    const { error } = await requestPasswordReset(email).catch(() => ({ error: "failed" as const }));
    setPassword(error ? "error" : "sent");
  }

  async function handleExport() {
    if (exporting) return;
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
      {holdsRole && (
        <div className="mb-4 flex flex-col items-start gap-3">
          <span className="rounded-full bg-stone-custom px-2.5 py-1 text-xs font-bold text-brand-white">
            {t("leave_board_chip")}
          </span>
          <p
            id="leave-role-held"
            className="flex items-start gap-2 rounded-xl bg-brand-orange/10 px-4 py-3 text-sm text-stone-custom"
          >
            <MdWarningAmber aria-hidden="true" className="mt-px size-[18px] shrink-0 text-brand-orange-text" />
            {t("leave_error_role_held")}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handlePassword}
          aria-disabled={password === "sending"}
          className={cn(BUTTON, "border-stone-custom/15 text-stone-custom hover:bg-stone-custom/5")}
        >
          <MdVpnKey aria-hidden="true" className="size-[18px]" />
          {t("change_password")}
        </button>
        <button
          type="button"
          onClick={handleExport}
          aria-disabled={exporting}
          className={cn(BUTTON, "border-stone-custom/15 text-stone-custom hover:bg-stone-custom/5")}
        >
          <MdFileDownload aria-hidden="true" className="size-[18px]" />
          {exporting ? t("download_generating") : t("download_data")}
        </button>
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          disabled={holdsRole}
          aria-describedby={holdsRole ? "leave-role-held" : undefined}
          className={cn(
            BUTTON,
            "border-brand-red/35 text-brand-red enabled:hover:bg-brand-red/5 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <MdLogout aria-hidden="true" className="size-[18px]" />
          {t("leave_button")}
        </button>
      </div>

      <LiveMessages
        statusClassName="text-stone-custom/65"
        errorClassName="text-brand-red"
        status={password === "sent" ? t("change_password_sent") : null}
        error={
          password === "error" ? t("change_password_error") : exportError ? t("download_error") : null
        }
      />

      <LeaveAssociationDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        memberNumber={memberNumber}
        onDownload={handleExport}
        downloading={exporting}
      />
    </>
  );
}
