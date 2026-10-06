"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdContentCopy } from "react-icons/md";
import { cn } from "@/lib/utils";
import { classifyExportError, postExport, saveResponseAsFile } from "@/lib/admin/export-client";
import AdminDialog from "../AdminDialog";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";

type EmailList = "association" | "newsletter";
const LISTS: readonly EmailList[] = ["association", "newsletter"];
const ENDPOINT = "/api/admin/members/emails";

type EmailsExportDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * A-16 "Exporta correus". Both outputs call the audited export route (each one writes an
 * `export.emails` entry), so no address count is shown up front: no read function returns it
 * without exporting. The copy output reports the real count after the call.
 */
export default function EmailsExportDialog({ open, onClose }: EmailsExportDialogProps) {
  const t = useTranslations("admin.members.emails");
  const tErr = useTranslations("admin.members.export_errors");
  const [list, setList] = useState<EmailList | null>(null);
  const [busy, setBusy] = useState<"copy" | "csv" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function reset() {
    setList(null);
    setError("");
    setStatus("");
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  /** Addresses of an `{ addresses }` export body (anything else reads as empty). */
  async function readAddresses(res: Response): Promise<string[]> {
    const body = (await res.json()) as { addresses?: unknown };
    return Array.isArray(body.addresses) ? body.addresses.filter((a): a is string => typeof a === "string") : [];
  }

  /**
   * Copy needs the clipboard write to start inside the click (Safari rejects it once the user
   * activation expired while awaiting the POST): with ClipboardItem the write begins now and
   * receives the blob as a promise. Without it, the old path (await, then writeText) is used.
   */
  async function copy(selected: EmailList) {
    const request = postExport(ENDPOINT, { list: selected, format: "json" });
    let count = 0;
    let exportError: string | null = null;
    const canStream =
      typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.clipboard?.write);

    if (canStream) {
      const blob = request.then(async (res) => {
        if (!res.ok) {
          exportError = tErr(await classifyExportError(res));
          throw new Error("export_failed");
        }
        const addresses = await readAddresses(res);
        count = addresses.length;
        return new Blob([addresses.join(", ")], { type: "text/plain" });
      });
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      } catch {
        setError(exportError ?? tErr("copy_failed"));
        return;
      }
      setStatus(t("copied", { count }));
      return;
    }

    const res = await request;
    if (!res.ok) {
      setError(tErr(await classifyExportError(res)));
      return;
    }
    const addresses = await readAddresses(res);
    try {
      await navigator.clipboard.writeText(addresses.join(", "));
    } catch {
      setError(tErr("copy_failed"));
      return;
    }
    setStatus(t("copied", { count: addresses.length }));
  }

  async function run(kind: "copy" | "csv") {
    if (!list || busy) return;
    setBusy(kind);
    setError("");
    setStatus("");
    try {
      if (kind === "copy") {
        await copy(list);
        return;
      }
      const res = await postExport(ENDPOINT, { list, format: "csv" });
      if (!res.ok) {
        setError(tErr(await classifyExportError(res)));
        return;
      }
      await saveResponseAsFile(res, `darkstone_emails_${list}.csv`);
      setStatus(t("downloaded"));
    } catch {
      setError(tErr("failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminDialog
      open={open}
      onClose={handleClose}
      onConfirm={() => run("csv")}
      title={t("title")}
      target={t("subtitle")}
      procedure="P-7"
      confirmLabel={busy === "csv" ? t("downloading") : t("download")}
      cancelLabel={t("close")}
      confirmDisabled={!list}
      confirmDisabledReason={t("pick_list")}
      busy={busy !== null}
      error={error || undefined}
    >
      <fieldset className="flex flex-col gap-3" disabled={busy !== null}>
        <legend className="mb-2 text-sm font-semibold text-stone-custom">{t("list_label")}</legend>
        {LISTS.map((item) => (
          <label
            key={item}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4",
              list === item ? "border-2 border-stone-custom" : "border-stone-custom/20",
            )}
          >
            <input
              type="radio"
              name="email-list"
              value={item}
              checked={list === item}
              onChange={() => {
                setList(item);
                setStatus("");
                setError("");
              }}
              className="mt-1 size-4 accent-stone-custom"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-bold text-stone-custom">{t(item)}</span>
              <span className="text-sm text-stone-custom/70">{t(`${item}_desc`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 rounded-xl bg-stone-custom/5 p-4 text-sm text-stone-custom">
        <p className="font-bold">{t("before_title")}</p>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li className="flex flex-col gap-2">
            {t("before_1")}
            <Notice kind="warning">{t("before_bcc")}</Notice>
          </li>
          <li>{t("before_2")}</li>
        </ol>
      </div>

      <button
        type="button"
        onClick={() => run("copy")}
        disabled={!list || busy !== null}
        className={adminButtonClass("secondary", "gap-2 self-start max-sm:w-full")}
      >
        <MdContentCopy aria-hidden="true" className="size-5" />
        {busy === "copy" ? t("copying") : t("copy")}
      </button>

      <p role="status" className="min-h-0 text-sm font-semibold text-green-700">
        {status}
      </p>
    </AdminDialog>
  );
}
