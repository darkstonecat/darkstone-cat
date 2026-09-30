import { useTranslations } from "next-intl";
import { MdEdit, MdLockOutline } from "react-icons/md";
import { Link } from "@/i18n/routing";
import type { MaskedValue } from "@/lib/profile/mask";

type MemberDataCardProps = {
  email: string;
  firstName: string;
  lastName: string;
  postalCode: string | null;
  /** Already masked on the server: the decrypted values never reach this component. */
  dni: MaskedValue | null;
  phone: MaskedValue | null;
};

/** "Dades de soci": read-only data sheet. Server component, so nothing sensitive is serialised to the client. */
export default function MemberDataCard({ email, firstName, lastName, postalCode, dni, phone }: MemberDataCardProps) {
  const t = useTranslations("profile");
  const d = useTranslations("profile.details");
  const notProvided = t("not_provided");

  const fields: { key: string; label: string; value: string | null; ariaLabel?: string }[] = [
    { key: "email", label: t("label_email"), value: email },
    { key: "first_name", label: t("label_first_name"), value: firstName },
    { key: "last_name", label: t("label_last_name"), value: lastName },
    {
      key: "dni",
      label: t("label_dni"),
      value: dni?.masked ?? null,
      ariaLabel: dni ? (dni.tail ? d("dni_ends_with", { tail: dni.tail }) : d("dni_hidden")) : undefined,
    },
    {
      key: "phone",
      label: t("label_phone"),
      value: phone?.masked ?? null,
      ariaLabel: phone ? (phone.tail ? d("phone_ends_with", { tail: phone.tail }) : d("phone_hidden")) : undefined,
    },
    { key: "postal_code", label: t("label_postal_code"), value: postalCode },
  ];

  return (
    <section aria-labelledby="member-data-title" className="rounded-2xl bg-brand-white p-5 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 id="member-data-title" className="text-[22px] font-bold text-stone-custom">
          {d("data_title")}
        </h2>
        <Link
          href="/profile/edit"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-custom/15 bg-brand-white px-[18px] text-sm font-semibold text-stone-custom transition-colors hover:bg-stone-custom/5"
        >
          <MdEdit aria-hidden="true" className="size-4" />
          {d("edit")}
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key}>
            <dt className="text-[13px] font-medium text-stone-custom/65">{f.label}</dt>
            <dd className="mt-1 break-words text-base text-stone-custom">
              {!f.value ? (
                <span className="text-stone-custom/65">{notProvided}</span>
              ) : f.ariaLabel ? (
                <>
                  <span aria-hidden="true">{f.value}</span>
                  <span className="sr-only">{f.ariaLabel}</span>
                </>
              ) : (
                f.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 flex items-start gap-2 text-[13px] text-stone-custom/65">
        <MdLockOutline aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {d("masked_note")}
      </p>
    </section>
  );
}
