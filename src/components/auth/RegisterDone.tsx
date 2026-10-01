"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MdCheck, MdOutlineMail, MdRefresh } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";

type ResendStatus = "idle" | "sending" | "sent" | "error";

/** Seconds the resend button stays disabled after a successful send. */
export const RESEND_COOLDOWN_MS = 60_000;

type Props = {
  /** Email the member just submitted; comes from form state, never from storage. */
  email: string;
  onBack: () => void;
};

/** Screen 02b: "Revisa el teu correu". Rendered under the swapped hero. */
export default function RegisterDone({ email, onBack }: Props) {
  const t = useTranslations("auth");
  const [status, setStatus] = useState<ResendStatus>("idle");
  const [errorKey, setErrorKey] = useState<
    "register_done_resend_error" | "register_done_resend_rate_limit"
  >("register_done_resend_error");

  useEffect(() => {
    if (status !== "sent") return;
    const timer = setTimeout(() => setStatus("idle"), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function handleResend() {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    const { error } = await createClient().auth.resend({ type: "signup", email });
    if (error) {
      setErrorKey(
        error.status === 429 || error.code === "over_email_send_rate_limit"
          ? "register_done_resend_rate_limit"
          : "register_done_resend_error"
      );
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  const disabled = status === "sending" || status === "sent";

  return (
    <section className="flex-1 bg-brand-beige px-4 py-8 md:px-12 md:pt-16 md:pb-[72px]">
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-5 rounded-2xl bg-brand-white p-6 text-center shadow-sm md:p-10">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-beige text-brand-orange-text"
        >
          <MdOutlineMail size={30} />
        </span>

        <p className="text-base leading-relaxed text-stone-custom">
          {t.rich("register_done_text", {
            email,
            strong: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={disabled}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-custom/15 bg-brand-white px-6 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:pointer-events-none disabled:opacity-70 md:w-auto"
        >
          {status === "sent" ? (
            <MdCheck size={16} aria-hidden="true" />
          ) : (
            <MdRefresh
              size={16}
              aria-hidden="true"
              className={status === "sending" ? "animate-spin" : undefined}
            />
          )}
          {status === "sending"
            ? t("register_done_resending")
            : status === "sent"
              ? t("register_done_resent")
              : t("register_done_resend")}
        </button>

        <div aria-live="polite" className="empty:-mt-5">
          {status === "sent" && (
            <p className="sr-only">{t("register_done_resent_live", { email })}</p>
          )}
          {status === "error" && (
            <p role="alert" className="text-[13px] text-brand-red">
              {t(errorKey)}
            </p>
          )}
        </div>

        <p className="text-[13px] text-stone-custom/65">
          {t("register_done_wrong")}{" "}
          <button
            type="button"
            onClick={onBack}
            className="font-semibold text-brand-orange-text underline transition-colors hover:text-brand-orange"
          >
            {t("register_done_back")}
          </button>
        </p>

        <div className="h-px w-full bg-stone-custom/10" />

        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-orange-text underline transition-colors hover:text-brand-orange"
        >
          {t("register_done_login")}
        </Link>
      </div>
    </section>
  );
}
