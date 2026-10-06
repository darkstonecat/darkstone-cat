"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { MdCheckCircleOutline, MdMailOutline, MdOutlineMail, MdMarkEmailRead } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { requestMagicLink } from "@/lib/supabase/magic-link-actions";
import {
  MAGIC_REDIRECT_COOKIE,
  MAGIC_REDIRECT_MAX_AGE,
  MAGIC_REDIRECT_PATH,
  safeRedirectPath,
} from "@/lib/safe-redirect";

type FormStatus = "idle" | "submitting" | "sending-link" | "link-sent" | "error";

type FieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "min-h-11 w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-[11px] text-base text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2 disabled:opacity-50";

const labelClass = "text-sm font-medium text-stone-custom/80";

/** GoTrue's answer for a banned account (`user_banned`, HTTP 400 "User is banned"). */
function isBannedError(error: { code?: string; message?: string }): boolean {
  return error.code === "user_banned" || /\bbanned\b/i.test(error.message ?? "");
}

const bannerBase = "rounded-xl border px-4 py-3 text-sm";
const errorBanner = `${bannerBase} border-red-200 bg-red-50 text-red-700`;

export default function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  // The generic sign-in error: wrong password, unknown account or former member (spec §4.4).
  const [credentialsError, setCredentialsError] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [email, setEmail] = useState("");
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const returnedToForm = useRef(false);

  const confirmed = searchParams.get("confirmed");
  const recovery = searchParams.get("recovery");
  const magic = searchParams.get("magic");
  const redirect = searchParams.get("redirect");
  const left = searchParams.get("left");

  const isBusy = status === "submitting" || status === "sending-link";
  const emailValid = EMAIL_RE.test(email.trim());

  useEffect(() => {
    if (status === "link-sent") sentHeadingRef.current?.focus();
    else if (status === "idle" && returnedToForm.current) {
      returnedToForm.current = false;
      emailRef.current?.focus();
    }
  }, [status]);

  function validate(data: { email: string; password: string }): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.email.trim()) {
      errs.email = t("required_field");
    } else if (!EMAIL_RE.test(data.email)) {
      errs.email = t("invalid_email");
    }
    if (!data.password.trim()) {
      errs.password = t("required_field");
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const fieldErrors = validate(data);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setStatus("submitting");
    setErrorMessage("");
    setCredentialsError(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setStatus("error");
      // GoTrue checks the ban before the password, so a banned (former) member gets exactly
      // the wrong-password error: a specific one would reveal who was a member (D-6).
      if (error.message === "Invalid login credentials" || isBannedError(error)) {
        setErrorMessage(t("login_error_invalid_credentials"));
        setCredentialsError(true);
      } else if (error.message === "Email not confirmed") {
        setErrorMessage(t("login_error_email_not_confirmed"));
      } else {
        setErrorMessage(t("login_error_generic"));
      }
      return;
    }

    // Hard navigation to ensure cookies are fully set before SSR reads them.
    // Using router.replace() here causes repeated RSC fetches due to
    // token refresh race between client-side Supabase and the middleware.
    window.location.href = safeRedirectPath(redirect, window.location.origin);
  }

  async function handleMagicLink() {
    if (!emailValid || isBusy) return;

    setStatus("sending-link");
    setErrorMessage("");
    setCredentialsError(false);
    setErrors({});

    // The email template cannot carry the destination, so remember it briefly.
    try {
      const prefix = locale === "ca" ? "" : `/${locale}`;
      const dest = safeRedirectPath(
        redirect,
        window.location.origin,
        `${prefix}/profile`
      );
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${MAGIC_REDIRECT_COOKIE}=${encodeURIComponent(dest)}; Path=${MAGIC_REDIRECT_PATH}; Max-Age=${MAGIC_REDIRECT_MAX_AGE}; SameSite=Lax${secure}`;
    } catch {
      // Cookies blocked: the link still works and lands on the default page.
    }

    // Sent through the server, which only mails confirmed accounts and always
    // answers the same, so the form never reveals who is a member.
    let failed = false;
    try {
      const { error } = await requestMagicLink(email.trim());
      failed = error !== null;
    } catch {
      failed = true;
    }
    if (failed) {
      setStatus("error");
      setErrorMessage(t("login_error_generic"));
      return;
    }

    setStatus("link-sent");
  }

  const cardClass =
    "flex flex-col gap-5 rounded-2xl bg-brand-white p-6 shadow-sm md:p-9";

  if (status === "link-sent") {
    return (
      <div className={cardClass}>
        <div className="flex flex-col items-start gap-4" role="status">
          <MdMarkEmailRead
            size={40}
            aria-hidden="true"
            className="text-brand-orange-text"
          />
          <h2
            ref={sentHeadingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-stone-custom outline-none"
          >
            {t("login_magic_sent_title")}
          </h2>
          <p className="text-[15px] leading-relaxed text-stone-custom/75">
            {t("login_magic_sent_text", { email: email.trim() })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            returnedToForm.current = true;
            setStatus("idle");
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone-custom/15 bg-brand-white px-6 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5"
        >
          {t("login_magic_sent_back")}
        </button>
      </div>
    );
  }

  return (
    <motion.form
      className={cardClass}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit}
      noValidate
    >
      <div aria-live="polite" className="flex flex-col gap-5 empty:hidden">
        {left === "1" && (
          <div
            role="status"
            className={`${bannerBase} flex items-start gap-2.5 border-green-200 bg-green-50 text-green-700`}
          >
            <MdCheckCircleOutline size={18} aria-hidden="true" className="mt-px shrink-0" />
            {t("login_left_notice")}
          </div>
        )}
        {confirmed === "success" && (
          <div
            role="status"
            className={`${bannerBase} border-green-200 bg-green-50 text-green-700`}
          >
            {t("login_confirmed_success")}
          </div>
        )}
        {confirmed === "error" && (
          <div role="alert" className={errorBanner}>
            {t("login_confirmed_error")}
          </div>
        )}
        {recovery === "error" && (
          <div role="alert" className={errorBanner}>
            {t("login_recovery_error")}
          </div>
        )}
        {magic === "error" && (
          <div role="alert" className={errorBanner}>
            {t("login_magic_error")}
          </div>
        )}
        {status === "error" && errorMessage && (
          <div role="alert" className={errorBanner}>
            {errorMessage}
          </div>
        )}
        {status === "error" && credentialsError && (
          // Shown with the generic error to everyone, so it reveals nothing (spec §4.4).
          <div className="flex flex-col items-start gap-3 border-t border-stone-custom/[0.12] pt-4">
            <p className="text-[13px] leading-normal text-stone-custom/75">{t("login_help_text")}</p>
            <Link
              href={{ pathname: "/contact", query: { subject: t("login_help_subject") } }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-custom/15 bg-brand-white px-5 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5 max-sm:w-full"
            >
              <MdMailOutline size={18} aria-hidden="true" />
              {t("login_help_button")}
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={labelClass}>
          {t("login_email_label")}
        </label>
        <input
          type="email"
          id="email"
          ref={emailRef}
          name="email"
          required
          autoComplete="email"
          value={email}
          disabled={isBusy}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          className={inputClass}
        />
        {errors.email && (
          <p id="email-error" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className={labelClass}>
            {t("login_password_label")}
          </label>
          <Link
            href="/forgot-password"
            className="-my-3 inline-flex items-center py-3 text-[13px] font-medium text-brand-orange-text underline transition-colors hover:text-brand-orange"
          >
            {t("login_forgot_password")}
          </Link>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={isBusy}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          onChange={() =>
            errors.password && setErrors((prev) => ({ ...prev, password: undefined }))
          }
          className={inputClass}
        />
        {errors.password && (
          <p id="password-error" className="text-xs text-red-600">
            {errors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isBusy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-stone-custom px-6 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
      >
        {t("login_submit")}
      </button>

      <div className="flex items-center gap-3 text-[13px] text-stone-custom/65">
        <span className="h-px flex-1 bg-stone-custom/[0.12]" />
        {t("login_divider")}
        <span className="h-px flex-1 bg-stone-custom/[0.12]" />
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={isBusy || !emailValid}
        aria-describedby="magic-helper"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-stone-custom/15 bg-brand-white px-6 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
      >
        <MdOutlineMail size={18} aria-hidden="true" />
        {t("login_magic_button")}
      </button>
      <p id="magic-helper" className="text-[13px] leading-normal text-stone-custom/65">
        {t("login_magic_helper")}
      </p>
    </motion.form>
  );
}
