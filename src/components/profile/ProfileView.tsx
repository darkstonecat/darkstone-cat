"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { motion } from "motion/react";
import { exportProfileData } from "@/lib/profile/actions";
import { formatCalendarDate } from "@/lib/format-date";
import DeleteAccountDialog from "./DeleteAccountDialog";

type ProfileViewProps = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  dni: string | null;
  postalCode: string | null;
  ludoyaUsername: string | null;
  bggUsername: string | null;
  memberNumber: string;
  role: "member" | "admin";
  newsletterAccepted: boolean;
  membershipStartDate: string | null;
};

function Field({ label, value, placeholder }: { label: string; value: string | null; placeholder: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-stone-custom/60">{label}</dt>
      <dd className="mt-1 text-stone-custom">
        {value || <span className="text-stone-custom/40">{placeholder}</span>}
      </dd>
    </div>
  );
}

export default function ProfileView({
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
  membershipStartDate,
}: ProfileViewProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const { data, error } = await exportProfileData();
    setExporting(false);

    if (error || !data) return;

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `darkstone-data-${memberNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const notProvided = t("not_provided");

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="space-y-10"
      >
        {/* Section: Personal data */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_personal")}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={t("label_email")} value={email} placeholder={notProvided} />
            <Field label={t("label_first_name")} value={firstName} placeholder={notProvided} />
            <Field label={t("label_last_name")} value={lastName} placeholder={notProvided} />
            <Field label={t("label_phone")} value={phone} placeholder={notProvided} />
            <Field label={t("label_dni")} value={dni} placeholder={notProvided} />
            <Field label={t("label_postal_code")} value={postalCode} placeholder={notProvided} />
          </dl>
        </section>

        {/* Section: Gaming profiles */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_gaming")}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={t("label_ludoya")} value={ludoyaUsername} placeholder={notProvided} />
            <Field label={t("label_bgg")} value={bggUsername} placeholder={notProvided} />
          </dl>
        </section>

        {/* Section: Membership */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-stone-custom">{t("section_membership")}</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={t("label_member_number")} value={memberNumber} placeholder={notProvided} />
            <Field
              label={t("label_role")}
              value={role === "admin" ? t("role_admin") : t("role_member")}
              placeholder={notProvided}
            />
            <Field
              label={t("label_newsletter")}
              value={newsletterAccepted ? t("newsletter_yes") : t("newsletter_no")}
              placeholder={notProvided}
            />
            <Field
              label={t("label_member_since")}
              value={membershipStartDate ? formatCalendarDate(membershipStartDate, locale) : null}
              placeholder={notProvided}
            />
          </dl>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 border-t border-stone-custom/10 pt-8">
          <Link
            href="/profile/edit"
            className="rounded-xl bg-stone-custom px-6 py-3 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90"
          >
            {t("edit_button")}
          </Link>
          <Link
            href="/profile/card"
            className="rounded-xl border border-stone-custom/15 bg-brand-white px-6 py-3 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5"
          >
            {t("card_button")}
          </Link>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-xl border border-stone-custom/15 bg-brand-white px-6 py-3 text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5 disabled:opacity-50"
          >
            {exporting ? t("download_generating") : t("download_data_button")}
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded-xl border border-red-200 bg-brand-white px-6 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            {t("delete_account_button")}
          </button>
        </div>
      </motion.div>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}
