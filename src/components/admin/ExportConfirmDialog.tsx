"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AdminDialog from "./AdminDialog";

type ExportConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function ExportConfirmDialog({ open, onClose }: ExportConfirmDialogProps) {
  const t = useTranslations("admin");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setDownloading(true);
    setError("");

    try {
      // POST + JSON body: the export routes refuse GET and check the Origin header (CSRF).
      const res = await fetch("/api/admin/members/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extract filename from Content-Disposition or use default
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match?.[1] ?? "darkstone_members.csv";

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloading(false);
      onClose();
    } catch {
      setError(t("export_error"));
      setDownloading(false);
    }
  }

  function handleClose() {
    if (downloading) return;
    setError("");
    onClose();
  }

  return (
    <AdminDialog
      open={open}
      onClose={handleClose}
      onConfirm={handleExport}
      title={t("export_title")}
      cancelLabel={t("export_cancel")}
      confirmLabel={downloading ? t("export_downloading") : t("export_confirm")}
      busy={downloading}
      error={error || undefined}
    >
      <p className="text-sm text-stone-custom/70">{t("export_warning")}</p>
    </AdminDialog>
  );
}
