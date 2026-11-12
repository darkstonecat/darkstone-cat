"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { AdminNavGroup, AdminSectionKey } from "./adminNav";

type AdminNavListProps = {
  groups: AdminNavGroup[];
  active: AdminSectionKey | null;
  /** `sheet` uses taller links for touch (phone bottom sheet). */
  size: "sidebar" | "sheet";
  /** Called when a link is chosen (the sheet closes). */
  onNavigate?: () => void;
};

/**
 * The grouped section links shared by the desktop sidebar and the phone sheet
 * (docs/features/admin-panel/navigation.md §2): optional group label, one link per section,
 * the help group last under a divider. The active link is dark and carries `aria-current`.
 */
export default function AdminNavList({ groups, active, size, onNavigate }: AdminNavListProps) {
  const t = useTranslations("admin");
  const idPrefix = useId();

  return (
    <div className="flex flex-col">
      {groups.map((group, index) => {
        const labelId = `${idPrefix}-${group.key}`;
        return (
          <div
            key={group.key}
            className={cn(
              group.key === "help"
                ? "mt-3 border-t border-stone-custom/10 pt-3"
                : group.labeled && index > 0 && "mt-4",
            )}
          >
            {group.labeled && (
              <p
                id={labelId}
                className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.14em] text-stone-custom/65 uppercase"
              >
                {t(`nav_group_${group.key}`)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5" aria-labelledby={group.labeled ? labelId : undefined}>
              {group.sections.map((section) => {
                const isActive = section.key === active;
                const Icon = section.icon;
                return (
                  <li key={section.key}>
                    <Link
                      href={section.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      data-autofocus={isActive && size === "sheet" ? "" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 transition-colors",
                        size === "sheet" ? "min-h-12 text-base" : "min-h-10 text-sm",
                        isActive
                          ? "bg-stone-custom font-semibold text-brand-white"
                          : "font-medium text-stone-custom/80 hover:bg-stone-custom/5 hover:text-stone-custom",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5 shrink-0" />
                      <span className="min-w-0 flex-1">{t(`tab_${section.key}`)}</span>
                      {section.superadminOnly && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                            isActive ? "bg-brand-white/15 text-brand-white" : "bg-brand-orange/10 text-brand-orange-text",
                          )}
                        >
                          {t("nav_superadmin_chip")}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
