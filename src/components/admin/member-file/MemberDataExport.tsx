"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MdFileDownload } from "react-icons/md";
import { classifyExportError, postExport, saveResponseAsFile } from "@/lib/admin/export-client";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";

/** Mirrors `admin_reveal_reason_min_length()` and the route's 500-character cap; the server checks both. */
const FORMER_REASON_MIN = 10;
const REASON_MAX = 500;

type MemberDataExportProps = {
  memberNumber: string;
  memberName: string;
  /** Former member: only a superadmin gets this button, and a written reason (10+) is required. */
  former: boolean;
};

/**
 * A-11 "Exporta dades". POST `/api/admin/members/<number>/data` with `{ reason? }`: optional for
 * an active member, required for a former one (BR-21). The page only renders this component when
 * the viewer may export (board for active, superadmin for former); the route checks again.
 */
export default function MemberDataExport({ memberNumber, memberName, former }: MemberDataExportProps) {
  const t = useTranslations("admin.member_file.export");
  const tErr = useTranslations("admin.members.export_errors");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const optionalReasonId = useId();

  function handleClose() {
    if (busy) return;
    setOpen(false);
    setReason("");
    setError("");
    setDone(false);
  }

  async function handleExport() {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const trimmed = reason.trim();
      const res = await postExport(
        `/api/admin/members/${encodeURIComponent(memberNumber)}/data`,
        trimmed ? { reason: trimmed } : {},
      );
      if (!res.ok) {
        setError(tErr(await classifyExportError(res)));
        return;
      }
      await saveResponseAsFile(res, `darkstone-data-${memberNumber}.json`);
      setDone(true);
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={adminButtonClass("secondary", "gap-2 max-md:w-full")}
      >
        <MdFileDownload aria-hidden="true" className="size-5" />
        {t("button")}
      </button>
      <AdminDialog
        open={open}
        onClose={handleClose}
        onConfirm={handleExport}
        title={t("title")}
        target={t("target", { number: memberNumber, name: memberName })}
        procedure="P-3"
        superadminOnly={former}
        confirmLabel={busy ? t("downloading") : t("confirm")}
        busy={busy}
        error={error || undefined}
        reason={
          former
            ? {
                label: t("reason_label"),
                value: reason,
                onChange: setReason,
                minLength: FORMER_REASON_MIN,
                maxLength: REASON_MAX,
                help: t("reason_help"),
              }
            : undefined
        }
      >
        <p className="text-sm text-stone-custom/70">{t("text")}</p>
        <Notice kind="warning">{t("warning")}</Notice>
        {!former && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={optionalReasonId} className="text-sm font-semibold text-stone-custom">
              {t("reason_optional_label")}
            </label>
            <textarea
              id={optionalReasonId}
              rows={2}
              maxLength={REASON_MAX}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full resize-y rounded-xl border border-stone-custom/20 bg-brand-white px-3.5 py-3 text-base text-stone-custom outline-none focus-visible:outline-2 focus-visible:outline-brand-orange disabled:opacity-50"
            />
            <p className="text-[13px] text-stone-custom/65">{t("reason_optional_help")}</p>
          </div>
        )}
        {done && (
          <p role="status" className="text-sm font-semibold text-green-700">
            {t("downloaded")}
          </p>
        )}
      </AdminDialog>
    </>
  );
}
