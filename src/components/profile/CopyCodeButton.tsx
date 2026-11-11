"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdCheck, MdContentCopy } from "react-icons/md";

type Status = "idle" | "copied" | "failed";

/** Copies a discount code and says so for two seconds (also to screen readers). */
export default function CopyCodeButton({ code, label }: { code: string; label: string }) {
  const t = useTranslations("profile.details");
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    let next: Status = "copied";
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      next = "failed";
    }
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={t("benefits_copy_label", { name: label })}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-custom/20 px-3 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5"
      >
        {status === "copied" ? <MdCheck aria-hidden="true" /> : <MdContentCopy aria-hidden="true" />}
        {status === "copied" ? t("benefits_copied") : t("benefits_copy")}
      </button>
      <span role="status" className="sr-only">
        {status === "copied" ? t("benefits_copied") : status === "failed" ? t("benefits_copy_failed") : ""}
      </span>
      {status === "failed" && (
        <span className="text-sm text-red-700" aria-hidden="true">
          {t("benefits_copy_failed")}
        </span>
      )}
    </>
  );
}
