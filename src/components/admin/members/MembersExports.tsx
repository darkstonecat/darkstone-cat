"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdFileDownload, MdMailOutline, MdMenuBook } from "react-icons/md";
import type { MemberRoleFilter } from "@/lib/admin/members-list";
import ExportConfirmDialog from "../ExportConfirmDialog";
import ReasonButton from "../ReasonButton";
import { adminButtonClass } from "../adminButtons";

type MembersExportsProps = {
  /** Current "Rol" filter: the CSV dialog offers it (and sends it) unless it is "all". */
  role: MemberRoleFilter;
  isSuperadmin: boolean;
};

/**
 * Export buttons of V-2. A-10 (CSV) opens its dialog now. A-16 (e-mails) and S-4 (llibre de
 * socis) have no dialog yet (T17): they render disabled with the visible reason "Properament",
 * and the S-4 button is only shown to superadmins.
 */
export default function MembersExports({ role, isSuperadmin }: MembersExportsProps) {
  const t = useTranslations("admin.members");
  const tAdmin = useTranslations("admin");
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-stone-custom/10 pt-4 md:flex-row md:flex-wrap md:items-start">
      <button
        type="button"
        onClick={() => setCsvOpen(true)}
        className={adminButtonClass("secondary", "gap-2 max-md:w-full")}
      >
        <MdFileDownload aria-hidden="true" className="size-5" />
        {t("export_csv")}
      </button>
      <ReasonButton disabled reason={t("export_soon")} className="gap-2 max-md:w-full">
        <MdMailOutline aria-hidden="true" className="size-5" />
        {t("export_emails")}
      </ReasonButton>
      {isSuperadmin && (
        <div className="flex flex-col gap-1.5 max-md:items-center">
          <ReasonButton disabled reason={t("export_soon")} className="gap-2 max-md:w-full">
            <MdMenuBook aria-hidden="true" className="size-5" />
            {t("export_register")}
          </ReasonButton>
          <span className="text-xs font-semibold text-stone-custom/65">{tAdmin("chip_superadmin_only")}</span>
        </div>
      )}
      <ExportConfirmDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        role={role === "all" ? undefined : role}
      />
    </div>
  );
}
