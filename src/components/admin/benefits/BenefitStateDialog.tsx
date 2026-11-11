"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { archiveBenefit, restoreBenefit } from "@/lib/admin/benefit-actions";
import type { AdminBenefitRow } from "@/lib/admin/benefits";
import { localize } from "@/lib/badges/catalogue";
import AdminDialog from "../AdminDialog";
import { benefitErrorKey } from "./shared";

export type BenefitStateAction = "archive" | "restore";

const ACTIONS = { archive: archiveBenefit, restore: restoreBenefit } as const;

type BenefitStateDialogProps = {
  /** The benefit and what to do with it; null keeps the dialog closed. */
  pending: { action: BenefitStateAction; benefit: AdminBenefitRow } | null;
  onClose: () => void;
  onDone: (action: BenefitStateAction) => void;
};

/** Confirmation of "Arxiva" (hides it from every member) and "Restaura". Errors keep it open. */
export default function BenefitStateDialog({ pending, onClose, onDone }: BenefitStateDialogProps) {
  const t = useTranslations("admin.benefits");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const action = pending?.action ?? "archive";

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
      const result = await ACTIONS[pending.action](pending.benefit.id);
      if ("error" in result) {
        setError(t(benefitErrorKey(result.error)));
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
      target={pending ? localize(pending.benefit.name, locale) : undefined}
      variant={action === "archive" ? "danger" : "neutral"}
      confirmLabel={t(`${action}_confirm`)}
      cancelLabel={t("form.cancel")}
      busy={busy}
      error={error}
    >
      <p className="text-sm text-stone-custom/80">{t(`${action}_text`)}</p>
    </AdminDialog>
  );
}
