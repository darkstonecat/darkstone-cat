"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";

type FormStatus = "idle" | "sending" | "success" | "error";

type FieldErrors = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

export default function ContactForm() {
  const t = useTranslations("contact_page");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): FieldErrors {
    const errs: FieldErrors = {};
    if (!data.name.trim()) errs.name = t("required_field");
    if (!data.email.trim()) {
      errs.email = t("required_field");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errs.email = t("invalid_email");
    }
    if (!data.subject.trim()) errs.subject = t("required_field");
    if (!data.message.trim()) errs.message = t("required_field");
    return errs;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    };

    const fieldErrors = validate(data);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error();

      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  const isSending = status === "sending";

  return (
    <div className="md:col-span-2">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
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
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-green-800">
              {t("success_title")}
            </h3>
            <p className="mb-6 max-w-sm text-sm text-green-700/80">
              {t("success_message")}
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              {t("submit")}
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            onSubmit={handleSubmit}
            noValidate
          >
            {status === "error" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span className="font-medium">{t("error_title")}:</span>{" "}
                {t("error_message")}
              </motion.div>
            )}

            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-stone-custom/70"
              >
                {t("name_label")}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder={t("name_placeholder")}
                disabled={isSending}
                onChange={() =>
                  errors.name && setErrors((e) => ({ ...e, name: undefined }))
                }
                className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange disabled:opacity-50"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-stone-custom/70"
              >
                {t("email_label")}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder={t("email_placeholder")}
                disabled={isSending}
                onChange={() =>
                  errors.email && setErrors((e) => ({ ...e, email: undefined }))
                }
                className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange disabled:opacity-50"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="subject"
                className="mb-2 block text-sm font-medium text-stone-custom/70"
              >
                {t("subject_label")}
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                placeholder={t("subject_placeholder")}
                disabled={isSending}
                onChange={() =>
                  errors.subject &&
                  setErrors((e) => ({ ...e, subject: undefined }))
                }
                className="w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange disabled:opacity-50"
              />
              {errors.subject && (
                <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm font-medium text-stone-custom/70"
              >
                {t("message_label")}
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                placeholder={t("message_placeholder")}
                disabled={isSending}
                onChange={() =>
                  errors.message &&
                  setErrors((e) => ({ ...e, message: undefined }))
                }
                className="w-full resize-none rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/30 outline-none transition-colors focus:border-brand-orange disabled:opacity-50"
              />
              {errors.message && (
                <p className="mt-1 text-xs text-red-600">{errors.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full rounded-xl bg-stone-custom px-6 py-3.5 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
            >
              {isSending ? t("sending") : t("submit")}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
