import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { formatAdminTimestamp } from "@/lib/admin/member-file";
import Notice from "../Notice";
import StatusChip from "../StatusChip";

export type RoleHolder = {
  id: string;
  member_number: string;
  name: string;
  role_since: string | null;
};

type RolesContentProps = {
  superadmins: RoleHolder[];
  board: RoleHolder[];
  /** Id of the signed-in superadmin (marks their own row). */
  viewerId: string;
  /** The lists could not be read: show a notice instead of two empty cards. */
  loadError?: boolean;
};

const CARD = "rounded-2xl bg-brand-white p-5 md:p-8";

/**
 * V-5 role overview (superadmin only; the page guards). Read-only: roles are changed from the
 * member file, where the server actions enforce BR-10..BR-12. Holders link to their file.
 */
export default function RolesContent({ superadmins, board, viewerId, loadError = false }: RolesContentProps) {
  const t = useTranslations("admin.roles");
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 md:pt-16">
      <p className="text-stone-custom/70">{t("intro")}</p>
      {loadError && (
        <Notice kind="blocked">
          <p className="font-bold">{t("load_error")}</p>
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <HolderCard kind="superadmin" title={t("superadmins_title")} holders={superadmins} viewerId={viewerId} />
          <HolderCard kind="board" title={t("board_title")} holders={board} viewerId={viewerId} />
          <p className="text-sm text-stone-custom/70">{t("how_to")}</p>
        </div>
        <section aria-labelledby="roles-explain" className={`${CARD} flex h-fit flex-col gap-4`}>
          <h2 id="roles-explain" className="text-xl font-bold text-stone-custom">
            {t("explain_title")}
          </h2>
          <p className="text-sm text-stone-custom/70">{t("explain_chain")}</p>
          <div className="flex flex-col divide-y divide-stone-custom/10">
            <div className="flex flex-col gap-1 py-3 first:pt-0">
              <strong className="text-stone-custom">{t("member_label")}</strong>
              <span className="text-sm text-stone-custom/70">{t("member_help")}</span>
            </div>
            <div className="flex flex-col items-start gap-1 py-3">
              <StatusChip kind="board" />
              <span className="text-sm text-stone-custom/70">{t("board_help")}</span>
            </div>
            <div className="flex flex-col items-start gap-1 py-3 last:pb-0">
              <StatusChip kind="superadmin" />
              <span className="text-sm text-stone-custom/70">{t("superadmin_help")}</span>
            </div>
          </div>
          <Notice kind="info">{t("min_two")}</Notice>
          <Notice kind="info">{t("former_note")}</Notice>
        </section>
      </div>
    </div>
  );
}

function HolderCard({
  kind,
  title,
  holders,
  viewerId,
}: {
  kind: "superadmin" | "board";
  title: string;
  holders: RoleHolder[];
  viewerId: string;
}) {
  const t = useTranslations("admin.roles");
  const tAdmin = useTranslations("admin");
  const headingId = `roles-${kind}`;
  const roleLabel = tAdmin(kind === "superadmin" ? "chip_superadmin" : "chip_board");
  return (
    <section aria-labelledby={headingId} className={`${CARD} flex flex-col gap-2`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-xl font-bold text-stone-custom">
          {title}
        </h2>
        <span className="text-sm text-stone-custom/65">{t("count", { count: holders.length })}</span>
      </div>
      {holders.length === 0 ? (
        <p className="text-sm text-stone-custom/65">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {holders.map((holder) => {
            const date = formatAdminTimestamp(holder.role_since);
            return (
              <li
                key={holder.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-stone-custom/10 py-4 first:border-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-stone-custom">
                    <span className="break-words">{holder.name}</span>
                    {holder.id === viewerId && (
                      <span className="rounded-full bg-stone-custom/7 px-2 py-0.5 text-xs font-bold text-stone-custom/80">
                        {t("you")}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-stone-custom/65">
                    {holder.member_number} · {date ? t("since", { role: roleLabel, date }) : t("since_unknown", { role: roleLabel })}
                  </span>
                </div>
                <Link
                  href={`/admin/members/${encodeURIComponent(holder.member_number)}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-orange-text"
                >
                  {t("view_file")}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
