"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdOutlineFileDownload } from "react-icons/md";
import { cn } from "@/lib/utils";

/** Downloads the PNG from `/api/members/card`; disabled while it is generated, inline alert on failure. */
export default function CardDownloadButton({ className }: { className?: string }) {
  const t = useTranslations("profile.card");
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/members/card");
      if (!res.ok) throw new Error("Failed to generate card");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? "carnet_darkstone.png";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl bg-brand-orange px-6 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-orange/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
      >
        <MdOutlineFileDownload aria-hidden="true" size={18} />
        {downloading ? t("downloading") : t("download")}
      </button>
      <p role="alert" className={cn("text-sm text-brand-white/80", !failed && "sr-only")}>
        {failed ? t("download_error") : ""}
      </p>
    </div>
  );
}
