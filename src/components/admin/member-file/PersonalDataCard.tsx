"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdEdit, MdInfoOutline } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import type { AdminMemberFileRow } from "@/lib/admin/member-file";
import { adminButtonClass } from "../adminButtons";
import { Field } from "./Field";
import MemberEditForm from "./MemberEditForm";
import RevealButton from "./RevealButton";

const NO_VALUE = "—";
const MASK = "••••••";

type PersonalDataCardProps = {
  member: AdminMemberFileRow;
  /** Former member's DNI can only be revealed by a superadmin (D-E, provisional). */
  canRevealFormerDni: boolean;
};

/**
 * "Dades personals" (active) / "Dades del registre" (former). Holds the A-4 edit mode and the A-5
 * reveal buttons. The "Edita" button lives in this card's header (not the page header) so the
 * edit state stays local; the page is refreshed after a save and the card keeps its notice.
 */
export default function PersonalDataCard({ member, canRevealFormerDni }: PersonalDataCardProps) {
  const t = useTranslations("admin.member_file");
  const tEdit = useTranslations("admin.member_file.edit");
  const router = useRouter();
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<"saved" | "unchanged" | null>(null);

  const mask = (
    <span aria-label={t("masked_label")}>
      {MASK} <span className="text-sm text-stone-custom/65">{t("masked")}</span>
    </span>
  );
  const showDniReveal = member.has_dni && (!former || canRevealFormerDni);
  const showPhoneReveal = !former && Boolean(member.has_phone);

  function handleSaved(changed: string[]) {
    setEditing(false);
    setSaved(changed.length > 0 ? "saved" : "unchanged");
    router.refresh();
  }

  return (
    <section aria-labelledby="mf-personal" className="flex flex-col gap-5 rounded-2xl bg-brand-white p-5 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="mf-personal" className="text-xl font-bold text-stone-custom">
          {former ? t("register_title") : t("personal_title")}
        </h3>
        {!former && !editing && (
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setEditing(true);
            }}
            className={adminButtonClass("secondary", "gap-2")}
          >
            <MdEdit aria-hidden="true" className="size-5" />
            {tEdit("open")}
          </button>
        )}
      </div>

      {saved && !editing && (
        <p role="status" className="text-sm font-semibold text-green-700">
          {tEdit(saved === "saved" ? "saved" : "unchanged")}
        </p>
      )}

      {editing ? (
        <MemberEditForm member={member} onCancel={() => setEditing(false)} onSaved={handleSaved} />
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {!former && (
              <Field label={t("email")} hint={t("email_hint")}>
                {member.email ?? NO_VALUE}
              </Field>
            )}
            {former && member.email && <Field label={t("email")}>{member.email}</Field>}
            <Field label={t("first_name")}>{member.first_name}</Field>
            <Field label={t("last_name")}>{member.last_name || NO_VALUE}</Field>
            <Field label={t("dni")}>
              {member.has_dni ? (
                <div className="flex flex-col items-start gap-2">
                  {mask}
                  {showDniReveal && (
                    <RevealButton
                      memberId={member.id}
                      memberNumber={member.member_number}
                      memberName={name}
                      field="dni"
                      former={former}
                    />
                  )}
                  {former && !canRevealFormerDni && (
                    <span className="text-[13px] text-stone-custom/65">{t("reveal_former_note")}</span>
                  )}
                </div>
              ) : (
                NO_VALUE
              )}
            </Field>
            {!former && (
              <>
                <Field label={t("phone")}>
                  {member.has_phone ? (
                    <div className="flex flex-col items-start gap-2">
                      {mask}
                      {showPhoneReveal && (
                        <RevealButton
                          memberId={member.id}
                          memberNumber={member.member_number}
                          memberName={name}
                          field="phone"
                          former={false}
                        />
                      )}
                    </div>
                  ) : (
                    NO_VALUE
                  )}
                </Field>
                <Field label={t("postal_code")}>{member.postal_code || NO_VALUE}</Field>
                <Field label={t("ludoya")}>{member.ludoya_username ? `@${member.ludoya_username}` : NO_VALUE}</Field>
                <Field label={t("bgg")}>{member.bgg_username || NO_VALUE}</Field>
                <Field label={t("newsletter")}>{member.newsletter_accepted ? t("yes") : t("no")}</Field>
              </>
            )}
            <Field label={t("login")}>{member.has_login ? t("login_yes") : t("login_no")}</Field>
          </dl>
          <p className="flex items-center gap-2 text-[13px] text-stone-custom/65">
            <MdInfoOutline aria-hidden="true" className="size-4 shrink-0" />
            {former ? t("former_footnote") : t("sensitive_footnote")}
          </p>
        </>
      )}
    </section>
  );
}
