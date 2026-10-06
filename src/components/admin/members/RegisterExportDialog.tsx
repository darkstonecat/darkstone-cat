"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { classifyExportError, postExport, saveResponseAsFile } from "@/lib/admin/export-client";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";

const ENDPOINT = "/api/admin/members/register";
/** Mirrors the route and `admin_reveal_reason_min_length()`; the server enforces both again. */
const REASON_MIN = 10;
const REASON_MAX = 500;

type RegisterExportDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * S-4 "Exporta el llibre de socis" (superadmin only; the trigger is only rendered for them and
 * the route checks the role again). The file carries former members' DNI/NIE (D-B), so a written
 * reason is required and stored in the audit entry. No row count is shown: it would need the
 * audited export itself.
 */
export default function RegisterExportDialog({ open, onClose }: RegisterExportDialogProps) {
  const t = useTranslations("admin.members.register");
  const tErr = useTranslations("admin.members.export_errors");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function handleClose() {
    if (busy) return;
    setReason("");
    setError("");
    setDone(false);
    onClose();
  }

  async function handleExport() {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const res = await postExport(ENDPOINT, { reason: reason.trim() });
      if (!res.ok) {
        setError(tErr(await classifyExportError(res)));
        return;
      }
      await saveResponseAsFile(res, "darkstone_llibre_socis.csv");
      setDone(true);
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleExport}
      title={t("title")}
      target={t("subtitle")}
      superadminOnly
      confirmLabel={busy ? t("downloading") : t("confirm")}
      busy={busy}
      error={error || undefined}
      reason={{
        label: t("reason_label"),
        value: reason,
        onChange: setReason,
        minLength: REASON_MIN,
        maxLength: REASON_MAX,
        help: t("reason_help"),
      }}
    >
      <Notice kind="warning">{t("warning")}</Notice>
      <div className="flex flex-col gap-1 text-sm text-stone-custom">
        <p className="font-bold">{t("columns_label")}</p>
        <p>{t("columns")}</p>
        <p className="text-[13px] text-stone-custom/65">{t("scope")}</p>
      </div>
      {done && (
        <p role="status" className="text-sm font-semibold text-green-700">
          {t("downloaded")}
        </p>
      )}
    </AdminDialog>
  );
}
