"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MdArrowBack } from "react-icons/md";
import { Link, useRouter } from "@/i18n/routing";
import type { AdminBadgeRow, BadgeHolder } from "@/lib/admin/badges";
import Notice from "../Notice";
import { adminButtonClass } from "../adminButtons";
import BadgeEditForm from "./BadgeEditForm";
import BadgeHolders from "./BadgeHolders";
import BadgeStateDialog from "./BadgeStateDialog";

type BadgeDetailProps = { badge: AdminBadgeRow; holders: BadgeHolder[]; holdersError: boolean };

/** `/admin/badges/<key>` (S7.3): back button, edit card with preview, holders. */
export default function BadgeDetail({ badge, holders, holdersError }: BadgeDetailProps) {
  const t = useTranslations("admin.badges");
  const router = useRouter();
  const [notice, setNotice] = useState<"saved" | "restored" | null>(null);
  const [restoring, setRestoring] = useState(false);
  const archived = Boolean(badge.archived_at);

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 pb-16 sm:px-6 md:pt-16">
      <Link href="/admin/badges" className={adminButtonClass("secondary", "gap-2 self-start")}>
        <MdArrowBack aria-hidden="true" className="size-5" />
        {t("edit.back")}
      </Link>

      {notice && (
        <div role="status">
          <Notice kind="info">
            <p className="font-bold">{notice === "saved" ? t("edit.saved") : t("restore_done")}</p>
          </Notice>
        </div>
      )}

      <BadgeEditForm
        // A refresh after saving brings the stored values: start the form again from them.
        key={`${badge.updated_at}-${badge.archived_at ?? ""}`}
        badge={badge}
        onSaved={() => setNotice("saved")}
        archivedActions={
          <div className="flex flex-col gap-3">
            <Notice kind="warning">
              <p>{t("edit.archived_notice")}</p>
            </Notice>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setRestoring(true);
              }}
              className={adminButtonClass("primary", "self-start")}
            >
              {t("restore")}
            </button>
          </div>
        }
        aside={<BadgeHolders badge={badge} holders={holders} loadError={holdersError} />}
      />

      {archived && (
        <BadgeStateDialog
          pending={restoring ? { action: "restore", badge } : null}
          onClose={() => setRestoring(false)}
          onDone={() => {
            setRestoring(false);
            setNotice("restored");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
