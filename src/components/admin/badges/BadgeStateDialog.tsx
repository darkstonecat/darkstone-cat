"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { archiveBadge, deleteBadge, restoreBadge } from "@/lib/admin/badge-actions";
import type { AdminBadgeRow } from "@/lib/admin/badges";
import { localize } from "@/lib/badges/catalogue";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import { badgeErrorKey } from "./shared";

export type BadgeStateAction = "archive" | "restore" | "delete";

const ACTIONS = { archive: archiveBadge, restore: restoreBadge, delete: deleteBadge } as const;

type BadgeStateDialogProps = {
  /** The badge and what to do with it; null keeps the dialog closed. */
  pending: { action: BadgeStateAction; badge: AdminBadgeRow } | null;
  onClose: () => void;
  /** Called after the action succeeded (the dialog is already closing). */
  onDone: (action: BadgeStateAction) => void;
};

/**
 * Confirmation of "Arxiva" (S7.6: big number of active holders who stop seeing it), "Restaura"
 * and "Esborra" (superadmin only) on the shared `AdminDialog`. Errors keep the dialog open.
 */
export default function BadgeStateDialog({ pending, onClose, onDone }: BadgeStateDialogProps) {
  const t = useTranslations("admin.badges");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const action = pending?.action ?? "archive";
  const badge = pending?.badge;

  function close() {
    if (busy) return;
    setError("");
    onClose();
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await ACTIONS[pending.action](pending.badge.key);
      if ("error" in result) {
        setError(t(badgeErrorKey(result.error)));
        return;
      }
      onDone(pending.action);
    } catch {
      setError(t("errors.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      open={pending !== null}
      onClose={close}
      onConfirm={confirm}
      title={t(`${action}_title`)}
      target={badge ? localize(badge.name, locale) : undefined}
      variant={action === "restore" ? "neutral" : "danger"}
      superadminOnly={action === "delete"}
      confirmLabel={busy ? t(`${action}_saving`) : t(`${action}_confirm`)}
      busy={busy}
      error={error || undefined}
    >
      {badge && action === "archive" && (
        <>
          <div>
            <p className="text-[40px] leading-tight font-extrabold tracking-tight text-stone-custom tabular-nums">
              {badge.active_holders}
            </p>
            <p className="text-stone-custom">{t("archive_count_text", { count: badge.active_holders })}</p>
          </div>
          <Notice kind="warning">
            <p>{t("archive_warning")}</p>
          </Notice>
        </>
      )}
      {badge && action === "restore" && (
        <p className="text-sm text-stone-custom">{t("restore_text", { count: badge.holders })}</p>
      )}
      {badge && action === "delete" && <p className="text-sm text-stone-custom">{t("delete_text")}</p>}
    </AdminDialog>
  );
}
