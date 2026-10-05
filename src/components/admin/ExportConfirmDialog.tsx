"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";

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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl bg-brand-white p-8 shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-stone-custom">{t("export_title")}</h2>
            <p className="mt-3 text-sm text-stone-custom/70">{t("export_warning")}</p>

            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                disabled={downloading}
                className="flex-1 rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:opacity-50"
              >
                {t("export_cancel")}
              </button>
              <button
                onClick={handleExport}
                disabled={downloading}
                className="flex-1 rounded-xl bg-stone-custom px-4 py-3 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/80 disabled:opacity-50 disabled:pointer-events-none"
              >
                {downloading ? t("export_downloading") : t("export_confirm")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
