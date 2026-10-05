"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { motion, AnimatePresence } from "motion/react";
import { updateMemberProfile, type ProfileUpdateError } from "@/lib/profile/actions";
import { roleLabelKey, type Role } from "@/lib/auth/roles";

type ProfileEditFormProps = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dni: string | null;
  postalCode: string | null;
  ludoyaUsername: string | null;
  bggUsername: string | null;
  memberNumber: string;
  role: Role;
  newsletterAccepted: boolean;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

const EDIT_ERROR_KEYS: Partial<Record<ProfileUpdateError, string>> = {
  invalid_name: "edit_name_error",
  invalid_phone: "edit_phone_error",
  invalid_dni: "edit_dni_error",
  invalid_postal_code: "edit_postal_code_error",
  invalid_username: "edit_username_error",
};

const inputClass =
  "w-full rounded-xl border border-stone-custom/15 bg-brand-white px-4 py-3 text-stone-custom placeholder:text-stone-custom/50 outline-none transition-colors focus:border-brand-orange focus-visible:outline-2 focus-visible:outline-brand-orange focus-visible:outline-offset-2 disabled:opacity-50";

const readOnlyClass =
  "w-full rounded-xl border border-stone-custom/10 bg-stone-custom/5 px-4 py-3 text-stone-custom/60";

export default function ProfileEditForm({
  email,
  firstName,
  lastName,
  phone,
  dni,
  postalCode,
  ludoyaUsername,
  bggUsername,
  memberNumber,
  role,
  newsletterAccepted,
}: ProfileEditFormProps) {
  const t = useTranslations("profile");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setStatus("submitting");
    setErrorMessage("");

    const { error } = await updateMemberProfile({
      first_name: fd.get("first_name") as string,
      last_name: fd.get("last_name") as string,
      phone: fd.get("phone") as string,
      dni: fd.get("dni") as string,
      postal_code: fd.get("postal_code") as string,
      ludoya_username: fd.get("ludoya_username") as string,
      bgg_username: fd.get("bgg_username") as string,
      newsletter_accepted: fd.get("newsletter") === "on",
    });

    if (error) {
      setStatus("error");
      setErrorMessage(t(EDIT_ERROR_KEYS[error] ?? "edit_error"));
      return;
    }

    setStatus("success");
    router.replace("/profile");
  }

  const isSubmitting = status === "submitting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
    >
      <AnimatePresence mode="wait">
        <motion.form
          key="edit-form"
          className="space-y-8"
          onSubmit={handleSubmit}
          noValidate
        >
          {status === "error" && errorMessage && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </motion.div>
          )}

          {/* Section: Personal data */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_personal")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Email — read-only */}
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_email")}
                </label>
                <div className={readOnlyClass}>{email}</div>
              </div>

              {/* First name */}
              <div>
                <label htmlFor="first_name" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_first_name")}{" "}
                  <span className="text-brand-red" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  maxLength={100}
                  defaultValue={firstName}
                  required
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>

              {/* Last name */}
              <div>
                <label htmlFor="last_name" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_last_name")}{" "}
                  <span className="text-brand-red" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  maxLength={100}
                  defaultValue={lastName}
                  required
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_phone")}
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={phone ?? ""}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>

              {/* DNI */}
              <div>
                <label htmlFor="dni" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_dni")}
                </label>
                <input
                  type="text"
                  id="dni"
                  name="dni"
                  defaultValue={dni ?? ""}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>

              {/* Postal code */}
              <div>
                <label htmlFor="postal_code" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_postal_code")}
                </label>
                <input
                  type="text"
                  id="postal_code"
                  name="postal_code"
                  defaultValue={postalCode ?? ""}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Section: Gaming profiles */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_gaming")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ludoya_username" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_ludoya")}
                </label>
                <input
                  type="text"
                  id="ludoya_username"
                  name="ludoya_username"
                  defaultValue={ludoyaUsername ?? ""}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="bgg_username" className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_bgg")}
                </label>
                <input
                  type="text"
                  id="bgg_username"
                  name="bgg_username"
                  defaultValue={bggUsername ?? ""}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Section: Membership (read-only display + newsletter toggle) */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_membership")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_member_number")}
                </label>
                <div className={readOnlyClass}>{memberNumber}</div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-stone-custom/80">
                  {t("label_role")}
                </label>
                <div className={readOnlyClass}>
                  {t(roleLabelKey(role))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="newsletter"
                    defaultChecked={newsletterAccepted}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-stone-custom/30 text-brand-orange accent-brand-orange"
                  />
                  <span className="text-sm text-stone-custom/80">
                    {tAuth("register_newsletter_checkbox")}
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 border-t border-stone-custom/10 pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-stone-custom px-6 py-3.5 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              {isSubmitting ? t("edit_saving") : t("edit_save")}
            </button>
            <Link
              href="/profile"
              className="rounded-xl border border-stone-custom/15 bg-brand-white px-6 py-3.5 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5"
            >
              {t("edit_cancel")}
            </Link>
          </div>
        </motion.form>
      </AnimatePresence>
    </motion.div>
  );
}
