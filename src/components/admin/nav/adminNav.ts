import type { IconType } from "react-icons";
import {
  MdAdminPanelSettings,
  MdBuild,
  MdCardGiftcard,
  MdGroup,
  MdHistory,
  MdMenuBook,
  MdMilitaryTech,
  MdSpaceDashboard,
} from "react-icons/md";

/** Section keys; their names are the `admin.tab_<key>` messages. */
export type AdminSectionKey =
  | "overview"
  | "members"
  | "activity"
  | "roles"
  | "badges"
  | "benefits"
  | "tools"
  | "procedures";

/** `main` and `help` have no label; the others are `admin.nav_group_<key>`. */
export type AdminNavGroupKey = "main" | "board" | "content" | "maintenance" | "help";

export type AdminSection = {
  key: AdminSectionKey;
  href: string;
  group: AdminNavGroupKey;
  icon: IconType;
  superadminOnly?: boolean;
};

export type AdminNavGroup = {
  key: AdminNavGroupKey;
  /** Shows the group name above its links. */
  labeled: boolean;
  sections: AdminSection[];
};

/** Group order, top to bottom (docs/features/admin-panel/navigation.md §2). */
const GROUPS: readonly { key: AdminNavGroupKey; labeled: boolean }[] = [
  { key: "main", labeled: false },
  { key: "board", labeled: true },
  { key: "content", labeled: true },
  { key: "maintenance", labeled: true },
  { key: "help", labeled: false },
];

/** Every admin section, in display order within its group. Add a new section here. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: "overview", href: "/admin", group: "main", icon: MdSpaceDashboard },
  { key: "members", href: "/admin/members", group: "board", icon: MdGroup },
  { key: "activity", href: "/admin/activity", group: "board", icon: MdHistory },
  { key: "roles", href: "/admin/roles", group: "board", icon: MdAdminPanelSettings, superadminOnly: true },
  { key: "badges", href: "/admin/badges", group: "content", icon: MdMilitaryTech },
  { key: "benefits", href: "/admin/benefits", group: "content", icon: MdCardGiftcard },
  { key: "tools", href: "/admin/tools", group: "maintenance", icon: MdBuild },
  { key: "procedures", href: "/admin/procedures", group: "help", icon: MdMenuBook },
];

/** The groups a member sees, in order; Rols only for superadmins, empty groups left out. */
export function visibleAdminNav(isSuperadmin: boolean): AdminNavGroup[] {
  const visible = ADMIN_SECTIONS.filter((s) => !s.superadminOnly || isSuperadmin);
  return GROUPS.map((g) => ({ ...g, sections: visible.filter((s) => s.group === g.key) })).filter(
    (g) => g.sections.length > 0,
  );
}

/** The section a path belongs to: nested paths keep their section, `/admin` matches only Resum. */
export function activeAdminSection(pathname: string): AdminSectionKey | null {
  let best: AdminSection | null = null;
  for (const section of ADMIN_SECTIONS) {
    const matches =
      section.href === "/admin"
        ? pathname === "/admin"
        : pathname === section.href || pathname.startsWith(`${section.href}/`);
    if (matches && (!best || section.href.length > best.href.length)) best = section;
  }
  return best?.key ?? null;
}
