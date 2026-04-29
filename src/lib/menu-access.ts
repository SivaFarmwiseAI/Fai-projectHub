export type RoleType = "CEO" | "Team Lead" | "Member" | "Admin";

/**
 * ALL_ROLES — Admin is listed first so it appears first in the admin UI matrix.
 */
export const ALL_ROLES: RoleType[] = ["Admin", "CEO", "Team Lead", "Member"];

export type MenuItemConfig = {
  key: string;
  label: string;
  href: string;
  section: string;
  allowedRoles: RoleType[];
  defaultRoles: RoleType[] | "all";
  badgeKey?: "reviews" | "capture";
  /** Locked items cannot be toggled in the menu access admin UI */
  locked?: boolean;
};

export const SECTION_ORDER = ["Overview", "Projects", "Work", "Team", "AI", "Settings"] as const;

export const DEFAULT_MENU_ITEMS: MenuItemConfig[] = [
  // ── Overview ─────────────────────────────────────────────────────────
  {
    key: "command-center",
    label: "Command Center",
    href: "/",
    section: "Overview",
    defaultRoles: "all",
    allowedRoles: [...ALL_ROLES],
    locked: true,
  },
  {
    key: "ceo-briefing",
    label: "CEO Briefing",
    href: "/briefing",
    section: "Overview",
    defaultRoles: ["Admin", "CEO"],
    allowedRoles: ["Admin", "CEO"],
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    section: "Overview",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },
  {
    key: "ceo-calendar",
    label: "CEO Calendar",
    href: "/calendar",
    section: "Overview",
    defaultRoles: ["Admin", "CEO"],
    allowedRoles: ["Admin", "CEO"],
  },
  {
    key: "my-calendar",
    label: "My Calendar",
    href: "/calendar",
    section: "Overview",
    defaultRoles: ["Team Lead", "Member"],
    allowedRoles: ["Team Lead", "Member"],
  },

  // ── Projects ─────────────────────────────────────────────────────────
  {
    key: "all-projects",
    label: "All Projects",
    href: "/projects",
    section: "Projects",
    defaultRoles: "all",
    allowedRoles: [...ALL_ROLES],
  },
  {
    key: "new-project",
    label: "New Project",
    href: "/projects/new",
    section: "Projects",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },
  {
    key: "timeline",
    label: "Timeline",
    href: "/projects/timeline",
    section: "Projects",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },
  {
    key: "templates",
    label: "Templates",
    href: "/templates",
    section: "Projects",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },

  // ── Work ─────────────────────────────────────────────────────────────
  {
    key: "daily-standup",
    label: "Daily Standup",
    href: "/standup",
    section: "Work",
    defaultRoles: "all",
    allowedRoles: [...ALL_ROLES],
  },
  {
    key: "discussions",
    label: "Discussions",
    href: "/discussions",
    section: "Work",
    defaultRoles: "all",
    allowedRoles: [...ALL_ROLES],
  },
  {
    key: "review-queue",
    label: "Review Queue",
    href: "/reviews",
    section: "Work",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
    badgeKey: "reviews",
  },

  // ── Team ─────────────────────────────────────────────────────────────
  {
    key: "team",
    label: "Team",
    href: "/team",
    section: "Team",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },
  {
    key: "manage-team",
    label: "Manage Team",
    href: "/team/manage",
    section: "Team",
    defaultRoles: ["Admin", "CEO"],
    allowedRoles: ["Admin", "CEO"],
  },
  {
    key: "leave-availability",
    label: "Leave & Availability",
    href: "/team/availability",
    section: "Team",
    defaultRoles: ["Admin", "CEO", "Team Lead"],
    allowedRoles: ["Admin", "CEO", "Team Lead"],
  },

  // ── AI ───────────────────────────────────────────────────────────────
  {
    key: "ai-capture",
    label: "AI Capture",
    href: "/capture",
    section: "AI",
    defaultRoles: ["Admin", "CEO"],
    allowedRoles: ["Admin", "CEO"],
    badgeKey: "capture",
  },

  // ── Settings (locked — always in place) ──────────────────────────────
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    section: "Settings",
    defaultRoles: "all",
    allowedRoles: [...ALL_ROLES],
    locked: true,
  },
  {
    key: "menu-access",
    label: "Menu Access",
    href: "/settings/menu-access",
    section: "Settings",
    // Admin + CEO can manage menu access (locked — cannot be removed by the UI itself)
    defaultRoles: ["Admin", "CEO"],
    allowedRoles: ["Admin", "CEO"],
    locked: true,
  },
];

const STORAGE_KEY = "projecthub_menu_access";

/**
 * Load saved allowedRoles overrides from localStorage and merge them
 * onto the default config.  Falls back to defaults on any error.
 */
export function loadMenuAccess(): MenuItemConfig[] {
  if (typeof window === "undefined") {
    return DEFAULT_MENU_ITEMS.map((i) => ({ ...i }));
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MENU_ITEMS.map((i) => ({ ...i }));

    const saved = JSON.parse(raw) as Record<string, RoleType[]>;
    return DEFAULT_MENU_ITEMS.map((item) => ({
      ...item,
      allowedRoles: item.locked
        ? [...item.allowedRoles]
        : (saved[item.key] ?? [...item.allowedRoles]),
    }));
  } catch {
    return DEFAULT_MENU_ITEMS.map((i) => ({ ...i }));
  }
}

/**
 * Persist only the `allowedRoles` overrides (non-locked items) to localStorage.
 */
export function saveMenuAccess(items: MenuItemConfig[]): void {
  if (typeof window === "undefined") return;
  const payload: Record<string, RoleType[]> = {};
  items.forEach((item) => {
    if (!item.locked) payload[item.key] = item.allowedRoles;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Clear saved config and return the original defaults.
 */
export function resetMenuAccess(): MenuItemConfig[] {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  return DEFAULT_MENU_ITEMS.map((i) => ({ ...i }));
}
