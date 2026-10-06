"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion, AnimatePresence } from "motion/react";
import { requestPasswordReset } from "@/lib/supabase/password-reset-actions";

type FormStatus = "idle" | "submitting" | "success" | "error";

type FieldErrors = {
  email?: string;
};

export default function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(email: string): FieldErrors {
    const errs: FieldErrors = {};
    if (!email.trim()) {
      errs.email = t("required_field");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t("invalid_email");
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (new FormData(form).get("email") as string).trim();

    const fieldErrors = validate(email);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setStatus("submitting");

    // Sent through the server, which only mails confirmed, active accounts and always answers
    // the same, so the form never reveals who has an account (spec §4.4). Only a failure that
    // does not depend on the address asks to retry.
    let failed = false;
    try {
      failed = (await requestPasswordReset(email)).error !== null;
    } catch {
      failed = true;
    }
    setStatus(failed ? "error" : "success");
  }

  const isSubmitting = status === "submitting";

  return (
    <div className="mx-auto w-full max-w-md">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-green-200 bg-green-50 px-6 py-16 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-7 w-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-green-800">
              {t("forgot_success_title")}
            </h3>
            <p className="mb-6 max-w-sm text-sm text-green-700/80">
              {t("forgot_success_message")}
            </p>
            <Link
              href="/login"
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              {t("forgot_back_to_login")}
            </Link>
          </motion.div>
        ) : (
          <motion.form
            key="forgot-form"
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            onSubmit={handleSubmit}
            noValidate
          >
            {status === "error" && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t("login_error_generic")}
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-stone-custom/80"
              >
                {t("forgot_email_label")}{" "}
                <span className="text-brand-red" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                onChange={() =>
                  errors.email && setErrors((e) => ({ ...e, email: undefined }))
                }
                className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2 disabled:opacity-50"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-red-600">
                  {errors.email}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-stone-custom px-6 py-3.5 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              {isSubmitting ? t("forgot_submitting") : t("forgot_submit")}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/login"
                className="text-brand-orange-text transition-colors hover:text-brand-orange"
              >
                {t("forgot_back_to_login")}
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
