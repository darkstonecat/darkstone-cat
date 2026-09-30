"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { setNewsletterAccepted } from "@/lib/profile/details-actions";
import { cn } from "@/lib/utils";
import LiveMessages from "./LiveMessages";

/**
 * Email opt-in switch. Optimistic: flips at once, rolls back if the save fails.
 * The track is 52 x 30 px but the button is 44 px high so the hit area is large enough.
 */
export default function NewsletterSwitch({ initialValue }: { initialValue: boolean }) {
  const t = useTranslations("profile.details");
  const titleId = useId();
  const hintId = useId();
  const [checked, setChecked] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function toggle() {
    if (busy) return;
    const next = !checked;
    setChecked(next);
    setBusy(true);
    setStatus("idle");
    const result = await setNewsletterAccepted(next).catch(() => ({ error: "failed" as const }));
    setBusy(false);
    if (result.error === null) {
      setStatus("saved");
    } else {
      setChecked(!next);
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-col gap-0.5">
          <span id={titleId} className="text-[15px] font-semibold text-stone-custom">
            {t("newsletter_title")}
          </span>
          <span id={hintId} className="text-[13px] text-stone-custom/65">
            {t("newsletter_hint")}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={titleId}
          aria-describedby={hintId}
          onClick={toggle}
          aria-disabled={busy}
          className="relative flex min-h-11 min-w-[52px] shrink-0 items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative block h-[30px] w-[52px] rounded-full transition-colors duration-150",
              checked ? "bg-brand-orange" : "bg-stone-custom/50",
              busy && "opacity-70"
            )}
          >
            <span
              className={cn(
                "absolute top-[3px] size-6 rounded-full bg-brand-white shadow transition-[left] duration-150",
                checked ? "left-[25px]" : "left-[3px]"
              )}
            />
          </span>
        </button>
      </div>
      <LiveMessages
        statusClassName="text-stone-custom/65"
        errorClassName="text-brand-red"
        status={status === "saved" ? (checked ? t("newsletter_on") : t("newsletter_off")) : null}
        error={status === "error" ? t("newsletter_error") : null}
      />
    </div>
  );
}
