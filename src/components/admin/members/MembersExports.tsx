"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdFileDownload, MdMailOutline, MdMenuBook } from "react-icons/md";
import type { MemberRoleFilter } from "@/lib/admin/members-list";
import ExportConfirmDialog from "../ExportConfirmDialog";
import { adminButtonClass } from "../adminButtons";
import EmailsExportDialog from "./EmailsExportDialog";
import RegisterExportDialog from "./RegisterExportDialog";

type MembersExportsProps = {
  /** Current "Rol" filter: the CSV dialog offers it (and sends it) unless it is "all". */
  role: MemberRoleFilter;
  isSuperadmin: boolean;
};

/**
 * Export buttons of V-2: A-10 (CSV), A-16 (e-mail lists) and, for superadmins only, S-4 (llibre
 * de socis). Every dialog POSTs to its audited route; the routes check the role again.
 */
export default function MembersExports({ role, isSuperadmin }: MembersExportsProps) {
  const t = useTranslations("admin.members");
  const tAdmin = useTranslations("admin");
  const [csvOpen, setCsvOpen] = useState(false);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

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
      <button
        type="button"
        onClick={() => setEmailsOpen(true)}
        className={adminButtonClass("secondary", "gap-2 max-md:w-full")}
      >
        <MdMailOutline aria-hidden="true" className="size-5" />
        {t("export_emails")}
      </button>
      {isSuperadmin && (
        <div className="flex flex-col gap-1.5 max-md:items-center">
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className={adminButtonClass("secondary", "gap-2 max-md:w-full")}
          >
            <MdMenuBook aria-hidden="true" className="size-5" />
            {t("export_register")}
          </button>
          <span className="text-xs font-semibold text-stone-custom/65">{tAdmin("chip_superadmin_only")}</span>
        </div>
      )}
      <ExportConfirmDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        role={role === "all" ? undefined : role}
      />
      <EmailsExportDialog open={emailsOpen} onClose={() => setEmailsOpen(false)} />
      {isSuperadmin && <RegisterExportDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />}
    </div>
  );
}
