"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MdClose, MdExpandMore } from "react-icons/md";
import { usePathname } from "@/i18n/routing";
import { useModalDialog } from "@/hooks/useModalDialog";
import AdminNavList from "./AdminNavList";
import { ADMIN_SECTIONS, activeAdminSection, visibleAdminNav } from "./adminNav";

/**
 * Phone and tablet navigation of the admin panel (below `lg`): one button with the current
 * section that opens a bottom sheet with every section, grouped like the desktop sidebar
 * (docs/features/admin-panel/navigation.md §5). The sheet closes on a link, Escape, the close
 * button, a tap on the backdrop, or a change of path.
 */
export default function AdminSectionSwitcher({ isSuperadmin }: { isSuperadmin: boolean }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  // The path the sheet was opened on: navigating elsewhere closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const active = activeAdminSection(pathname) ?? "overview";
  const current = ADMIN_SECTIONS.find((s) => s.key === active) ?? ADMIN_SECTIONS[0];
  const Icon = current.icon;

  const close = () => setOpenedOn(null);

  useModalDialog({ active: open, panelRef, onEscape: close, returnFocus: buttonRef });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenedOn(pathname)}
        className="mt-4 flex min-h-13 w-full items-center gap-3 rounded-2xl border border-brand-white/20 bg-brand-white/5 px-4 text-left text-xl font-bold text-brand-white transition-colors hover:bg-brand-white/10 lg:hidden"
      >
        <Icon aria-hidden="true" className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{t(`tab_${current.key}`)}</span>
        <span className="text-xs font-medium text-brand-white/65">{t("nav_switch")}</span>
        <MdExpandMore aria-hidden="true" className="size-5 shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            data-testid="admin-nav-backdrop"
            className="fixed inset-0 z-50 flex items-end bg-stone-custom/60 lg:hidden"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              data-lenis-prevent
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-brand-white px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_64px_rgba(12,10,9,0.35)] outline-none"
            >
              <div className="flex items-center justify-between gap-4 pb-2 pl-3">
                <h2 id={titleId} className="text-lg font-bold text-stone-custom">
                  {t("tabs_label")}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("dialog_close")}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-custom/15 text-stone-custom transition-colors hover:bg-stone-custom/5"
                >
                  <MdClose aria-hidden="true" className="size-5" />
                </button>
              </div>
              <nav aria-label={t("tabs_label")}>
                <AdminNavList groups={visibleAdminNav(isSuperadmin)} active={active} size="sheet" onNavigate={close} />
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
