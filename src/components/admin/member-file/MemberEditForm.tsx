"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MdInfoOutline, MdLock } from "react-icons/md";
import { updateMember, type MemberUpdateInput } from "@/lib/admin/member-actions";
import { normalizeUsername } from "@/lib/profile/username-pattern";
import { isValidDniNie, isValidPhone, isValidPostalCode } from "@/lib/validation/member-fields";
import { adminButtonClass } from "../adminButtons";
import { INPUT_CLASS, errorKey } from "./errors";

const NAME_MAX = 100;

type EditableMember = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  postal_code: string | null;
  ludoya_username: string | null;
  bgg_username: string | null;
  has_dni: boolean;
  has_phone: boolean | null;
};

type FieldKey = "name" | "phone" | "dni" | "postal_code" | "username";

type MemberEditFormProps = {
  member: EditableMember;
  onCancel: () => void;
  /** Called after a successful save (the caller refreshes the page and shows the notice). */
  onSaved: (changed: string[]) => void;
};

/**
 * A-4 inline edit form. DNI and phone start EMPTY and are sent only when the admin typed a new
 * value: the stored value never reaches the browser, and a field that was not touched must not
 * write a spurious audit entry. Everything else is sent as shown (the database writes no entry
 * for an unchanged value).
 */
export default function MemberEditForm({ member, onCancel, onSaved }: MemberEditFormProps) {
  const t = useTranslations("admin.member_file.edit");
  const tErr = useTranslations("admin.member_file.errors");
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [postalCode, setPostalCode] = useState(member.postal_code ?? "");
  const [ludoya, setLudoya] = useState(member.ludoya_username ?? "");
  const [bgg, setBgg] = useState(member.bgg_username ?? "");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function validate(): Partial<Record<FieldKey, string>> {
    const found: Partial<Record<FieldKey, string>> = {};
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last || first.length > NAME_MAX || last.length > NAME_MAX) found.name = t("error_name");
    if (phone.trim() && !isValidPhone(phone.trim())) found.phone = t("error_phone");
    if (dni.trim() && !isValidDniNie(dni.trim())) found.dni = t("error_dni");
    if (postalCode.trim() && !isValidPostalCode(postalCode.trim())) found.postal_code = t("error_postal_code");
    for (const raw of [ludoya, bgg]) {
      if (raw.trim() && !normalizeUsername(raw)) found.username = t("error_username");
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError("");
    const found = validate();
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    const input: MemberUpdateInput = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      postal_code: postalCode.trim(),
      ludoya_username: ludoya.trim(),
      bgg_username: bgg.trim(),
    };
    // Only what the admin typed: an untouched (empty) field is not part of the request.
    if (phone.trim()) input.phone = phone.trim();
    if (dni.trim()) input.dni = dni.trim();

    setBusy(true);
    try {
      const result = await updateMember(member.id, input);
      if ("error" in result) {
        const fieldCode: Record<string, FieldKey> = {
          invalid_name: "name",
          invalid_phone: "phone",
          invalid_dni: "dni",
          invalid_postal_code: "postal_code",
          invalid_username: "username",
        };
        const key = fieldCode[result.error];
        if (key) setFieldErrors({ [key]: t(`error_${key}`) });
        else setFormError(tErr(errorKey(result.error)));
        return;
      }
      onSaved(result.changed);
    } catch {
      setFormError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = (key: FieldKey) =>
    `${INPUT_CLASS} ${fieldErrors[key] ? "border-brand-red focus:border-brand-red" : ""}`;
  const describedBy = (key: FieldKey) => (fieldErrors[key] ? `edit-${key}-error` : undefined);
  const errorText = (key: FieldKey) =>
    fieldErrors[key] ? (
      <p id={`edit-${key}-error`} className="mt-1.5 text-sm text-brand-red">
        {fieldErrors[key]}
      </p>
    ) : null;
  const labelClass = "mb-2 block text-sm font-medium text-stone-custom/80";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5" aria-label={t("form_label")}>
      {formError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="edit-email" className={labelClass}>
            <MdLock aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
            {t("email")}
          </label>
          <input
            id="edit-email"
            value={member.email ?? ""}
            disabled
            readOnly
            className={`${INPUT_CLASS} bg-stone-custom/5 text-stone-custom/60`}
          />
          <p className="mt-1.5 text-[13px] text-stone-custom/65">{t("email_hint")}</p>
        </div>
        <div>
          <label htmlFor="edit-first-name" className={labelClass}>
            {t("first_name")} <span aria-hidden="true" className="text-brand-red">*</span>
          </label>
          <input
            id="edit-first-name"
            name="first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={NAME_MAX}
            required
            disabled={busy}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            className={fieldClass("name")}
          />
        </div>
        <div>
          <label htmlFor="edit-last-name" className={labelClass}>
            {t("last_name")} <span aria-hidden="true" className="text-brand-red">*</span>
          </label>
          <input
            id="edit-last-name"
            name="last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={NAME_MAX}
            required
            disabled={busy}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            className={fieldClass("name")}
          />
        </div>
        <div className="sm:col-span-2">{errorText("name")}</div>
        <div>
          <label htmlFor="edit-phone" className={labelClass}>
            {t("phone")}
          </label>
          <input
            id="edit-phone"
            name="phone"
            type="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={member.has_phone ? t("keep_placeholder") : t("empty_placeholder")}
            disabled={busy}
            aria-invalid={fieldErrors.phone ? true : undefined}
            aria-describedby={describedBy("phone")}
            className={fieldClass("phone")}
          />
          {errorText("phone")}
        </div>
        <div>
          <label htmlFor="edit-dni" className={labelClass}>
            {t("dni")}
          </label>
          <input
            id="edit-dni"
            name="dni"
            autoComplete="off"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            placeholder={member.has_dni ? t("keep_placeholder") : t("empty_placeholder")}
            disabled={busy}
            aria-invalid={fieldErrors.dni ? true : undefined}
            aria-describedby={describedBy("dni")}
            className={fieldClass("dni")}
          />
          {errorText("dni")}
        </div>
        <div>
          <label htmlFor="edit-postal-code" className={labelClass}>
            {t("postal_code")} <span className="font-normal text-stone-custom/60">({t("optional")})</span>
          </label>
          <input
            id="edit-postal-code"
            name="postal_code"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            disabled={busy}
            aria-invalid={fieldErrors.postal_code ? true : undefined}
            aria-describedby={describedBy("postal_code")}
            className={fieldClass("postal_code")}
          />
          {errorText("postal_code")}
        </div>
        <div className="hidden sm:block" />
        <div>
          <label htmlFor="edit-ludoya" className={labelClass}>
            {t("ludoya")} <span className="font-normal text-stone-custom/60">({t("optional")})</span>
          </label>
          <input
            id="edit-ludoya"
            name="ludoya_username"
            value={ludoya}
            onChange={(e) => setLudoya(e.target.value)}
            disabled={busy}
            aria-invalid={fieldErrors.username ? true : undefined}
            aria-describedby={describedBy("username")}
            className={fieldClass("username")}
          />
        </div>
        <div>
          <label htmlFor="edit-bgg" className={labelClass}>
            {t("bgg")} <span className="font-normal text-stone-custom/60">({t("optional")})</span>
          </label>
          <input
            id="edit-bgg"
            name="bgg_username"
            value={bgg}
            onChange={(e) => setBgg(e.target.value)}
            disabled={busy}
            aria-invalid={fieldErrors.username ? true : undefined}
            aria-describedby={describedBy("username")}
            className={fieldClass("username")}
          />
        </div>
        <div className="sm:col-span-2">{errorText("username")}</div>
      </div>
      <p className="flex items-center gap-2 text-[13px] text-stone-custom/65">
        <MdInfoOutline aria-hidden="true" className="size-4 shrink-0" />
        {t("audit_note")}
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button type="button" onClick={onCancel} disabled={busy} className={adminButtonClass("secondary", "max-sm:w-full")}>
          {t("cancel")}
        </button>
        <button type="submit" disabled={busy} className={adminButtonClass("primary", "max-sm:w-full")}>
          {busy ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
