"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdAutorenew, MdMailOutline } from "react-icons/md";
import { useRouter } from "@/i18n/routing";
import { regenerateCard } from "@/lib/admin/member-actions";
import { sendAccessLink } from "@/lib/admin/access-actions";
import { formatAdminTimestamp, type AdminMemberFileRow } from "@/lib/admin/member-file";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import ReasonButton from "../ReasonButton";
import StatusChip from "../StatusChip";
import { errorKey } from "./errors";

type CardSectionProps = {
  member: Pick<
    AdminMemberFileRow,
    "id" | "member_number" | "state" | "first_name" | "last_name" | "has_login" | "card_valid" | "card_issued_at"
  >;
};

/**
 * "Carnet" card of the member file: state, A-9 (regenerate the card) and A-15 (send an access
 * link). The token and the member's address are never shown. Outcomes live here so they survive
 * the `router.refresh()`.
 */
export default function CardSection({ member }: CardSectionProps) {
  const t = useTranslations("admin.member_file");
  const tc = useTranslations("admin.member_file.card_actions");
  const tErr = useTranslations("admin.member_file.errors");
  const router = useRouter();
  const former = member.state === "former";
  const name = `${member.first_name} ${member.last_name}`.trim();
  const target = t("membership.target", { number: member.member_number, name });
  const issued = formatAdminTimestamp(member.card_issued_at);

  const [outcome, setOutcome] = useState<"regenerated" | "link_sent" | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function closeCard() {
    if (busy) return;
    setCardOpen(false);
    setError("");
  }

  function closeLink() {
    if (busy) return;
    setLinkOpen(false);
    setLimited(false);
    setError("");
  }

  async function handleRegenerate() {
    setBusy(true);
    setError("");
    try {
      const result = await regenerateCard(member.id);
      if ("error" in result) {
        setError(tErr(errorKey(result.error)));
        return;
      }
      setCardOpen(false);
      setOutcome("regenerated");
      router.refresh();
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendLink() {
    setBusy(true);
    setError("");
    try {
      const result = await sendAccessLink(member.id);
      if ("error" in result) {
        if (result.error === "rate_limited") {
          setLimited(true);
          const retryAfter = "retryAfter" in result ? result.retryAfter : null;
          setError(
            typeof retryAfter === "number" && retryAfter > 0
              ? tc("link_rate_limited", { minutes: Math.max(1, Math.ceil(retryAfter / 60)) })
              : tc("link_rate_limited_unknown"),
          );
        } else {
          setError(tErr(errorKey(result.error)));
        }
        return;
      }
      setLinkOpen(false);
      setOutcome("link_sent");
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  const cardBlock = former ? tc("blocked_former") : "";
  const linkBlock = former ? tc("blocked_former") : !member.has_login ? tc("link_blocked_no_login") : "";

  return (
    <section aria-labelledby="mf-card" className="flex flex-col gap-3 rounded-2xl bg-brand-white p-5 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <h3 id="mf-card" className="text-xl font-bold text-stone-custom">
          {t("card_title")}
        </h3>
        <StatusChip kind={member.card_valid ? "valid" : "invalid"} />
      </div>
      {former ? (
        <p className="text-sm text-stone-custom/70">{t("card_former")}</p>
      ) : (
        <p className="text-sm text-stone-custom/70">
          {issued ? t("card_issued", { date: issued }) : t("card_no_date")}
        </p>
      )}
      {outcome && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{tc(outcome === "regenerated" ? "regenerate_done" : "link_done")}</p>
          </Notice>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ReasonButton
          variant="secondary"
          reason={cardBlock}
          disabled={cardBlock !== ""}
          onClick={() => {
            setOutcome(null);
            setCardOpen(true);
          }}
          className="gap-2 max-sm:w-full"
        >
          <MdAutorenew aria-hidden="true" className="size-5" />
          {tc("regenerate_button")}
        </ReasonButton>
        <ReasonButton
          variant="secondary"
          reason={linkBlock}
          disabled={linkBlock !== ""}
          onClick={() => {
            setOutcome(null);
            setLinkOpen(true);
          }}
          className="gap-2 max-sm:w-full"
        >
          <MdMailOutline aria-hidden="true" className="size-5" />
          {tc("link_button")}
        </ReasonButton>
      </div>

      <AdminDialog
        open={cardOpen}
        onClose={closeCard}
        onConfirm={handleRegenerate}
        title={tc("regenerate_title")}
        target={target}
        procedure="P-5"
        confirmLabel={busy ? tc("regenerate_saving") : tc("regenerate_confirm")}
        busy={busy}
        error={error || undefined}
      >
        <p className="text-sm text-stone-custom">{tc("regenerate_text")}</p>
        <p className="text-[13px] text-stone-custom/65">{tc("regenerate_caption")}</p>
      </AdminDialog>

      <AdminDialog
        open={linkOpen}
        onClose={closeLink}
        onConfirm={handleSendLink}
        title={tc("link_title")}
        target={target}
        procedure="P-6"
        confirmLabel={busy ? tc("link_saving") : tc("link_confirm")}
        confirmDisabled={limited}
        confirmDisabledReason={tc("link_limited_reason")}
        busy={busy}
        error={error || undefined}
      >
        <ul className="flex list-disc flex-col gap-1 rounded-xl bg-stone-custom/5 p-4 pl-9 text-sm text-stone-custom">
          {(["link_info_1", "link_info_2", "link_info_3"] as const).map((key) => (
            <li key={key}>{tc(key)}</li>
          ))}
        </ul>
      </AdminDialog>
    </section>
  );
}
