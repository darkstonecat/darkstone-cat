"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import AdminNavList from "./AdminNavList";
import { activeAdminSection, visibleAdminNav } from "./adminNav";

/**
 * Desktop navigation of the admin panel (from `lg`): a white card with the grouped sections,
 * sticky under the NavBar while the page scrolls. Below `lg` the header's section switcher
 * takes over (docs/features/admin-panel/navigation.md §4).
 */
export default function AdminSidebar({ isSuperadmin }: { isSuperadmin: boolean }) {
  const t = useTranslations("admin");
  const active = activeAdminSection(usePathname());

  return (
    <nav
      aria-label={t("tabs_label")}
      className="hidden w-56 shrink-0 rounded-2xl bg-brand-white p-2 lg:sticky lg:top-24 lg:mt-16 lg:block"
    >
      <AdminNavList groups={visibleAdminNav(isSuperadmin)} active={active} size="sidebar" />
    </nav>
  );
}
