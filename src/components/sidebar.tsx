"use client";

import { useState, useEffect, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Plus, ClipboardCheck,
  Users, UserPlus, CalendarDays, Calendar, Sparkles,
  LogOut, ChevronDown, X, ChevronRight,
  MessageSquare, Activity,
  BarChart3, FileText, GanttChart, LayoutTemplate,
  Settings, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { analytics as analyticsApi } from "@/lib/api-client";
import { useMenuAccess } from "@/contexts/menu-access-context";
import { showToast } from "@/lib/toast";
import { NotificationBell } from "@/components/notification-panel";
import { CommandPaletteTrigger } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SECTION_ORDER, type MenuItemConfig } from "@/lib/menu-access";

/* ── Icon map: key → Lucide icon component ──────────────────── */
const ITEM_ICONS: Record<string, typeof LayoutDashboard> = {
  "command-center":    LayoutDashboard,
  "ceo-briefing":      FileText,
  "analytics":         BarChart3,
  "ceo-calendar":      Calendar,
  "my-calendar":       Calendar,
  "all-projects":      FolderKanban,
  "new-project":       Plus,
  "timeline":          GanttChart,
  "templates":         LayoutTemplate,
  "daily-standup":     Activity,
  "discussions":       MessageSquare,
  "review-queue":      ClipboardCheck,
  "team":              Users,
  "manage-team":       UserPlus,
  "leave-availability":CalendarDays,
  "ai-capture":        Sparkles,
  "settings":          Settings,
  "menu-access":       ShieldCheck,
};

/* ── Context so AppShell can toggle the mobile drawer ─────── */
export const SidebarContext = createContext<{
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}>({ mobileOpen: false, setMobileOpen: () => {} });
export const useSidebar = () => useContext(SidebarContext);

/* ── Main component ─────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout, isCEO, isLead, isAdmin } = useAuth();
  const { menuItems } = useMenuAccess();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed]       = useState(false);
  const [reviewCount, setReviewCount]   = useState(0);
  const [captureCount, setCaptureCount] = useState(0);

  const badgeCounts: Record<string, number> = { reviews: reviewCount, capture: captureCount };

  useEffect(() => {
    analyticsApi.dashboard().then(r => {
      setReviewCount(r.stats.pending_reviews);
      setCaptureCount(r.stats.pending_captures);
    }).catch(() => {});
  }, []);

  const userRole = user?.roleType ?? "Member";

  /* Build visible sections from context-driven menu items */
  const visibleItems = menuItems.filter((item) =>
    item.allowedRoles.includes(userRole as "CEO" | "Team Lead" | "Member" | "Admin")
  );

  const visibleSections = SECTION_ORDER
    .map((sectionTitle) => ({
      title: sectionTitle,
      items: visibleItems.filter((item) => item.section === sectionTitle),
    }))
    .filter((s) => s.items.length > 0);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname, setMobileOpen]);
  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = () => setUserMenuOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userMenuOpen]);

  function handleLogout() {
    showToast.info("Signed out", "See you next time!");
    logout();
    router.replace("/login");
  }

  /* Role badge for user profile */
  function RoleBadge() {
    const config = isAdmin
      ? { label: "Admin",  bg: "rgba(234,88,12,0.2)",   color: "#fdba74" }
      : isCEO
      ? { label: "CEO",    bg: "rgba(59,130,246,0.2)",  color: "#93c5fd" }
      : isLead
      ? { label: "Lead",   bg: "rgba(16,185,129,0.2)",  color: "#6ee7b7" }
      : { label: "Member", bg: "rgba(236,72,153,0.2)",  color: "#f9a8d4" };
    return (
      <span
        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
        style={{ background: config.bg, color: config.color }}
      >
        {config.label}
      </span>
    );
  }

  /* Shared nav item renderer */
  function NavItem({ item }: { item: MenuItemConfig }) {
    const IconComponent = ITEM_ICONS[item.key] ?? LayoutDashboard;
    const isActive =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href));
    const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

    const iconEl = (
      <IconComponent className={cn(
        "h-[17px] w-[17px] shrink-0 transition-all duration-150",
        isActive ? "text-white" : "text-slate-400 group-hover:text-blue-300",
        "group-hover:scale-110"
      )} />
    );

    const linkContent = (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "sidebar-nav-item relative flex items-center gap-3 rounded-xl font-medium group",
          collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5",
          isActive
            ? "sidebar-nav-active text-white"
            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
        )}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-white/70" />
        )}
        {iconEl}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-[13px]">{item.label}</span>
            {item.badgeKey && count > 0 && (
              <span className={cn(
                "animate-badge-pop flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold px-1.5",
                isActive ? "bg-white/25 text-white" : "bg-amber-500 text-white"
              )}>
                {count}
              </span>
            )}
          </>
        )}
        {collapsed && item.badgeKey && count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 border-2 border-[#1e1b4b] text-[9px] font-bold text-white flex items-center justify-center">
            {count}
          </span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger>{linkContent}</TooltipTrigger>
          <TooltipContent side="right">
            <span className="font-semibold">{item.label}</span>
            {item.badgeKey && count > 0 && (
              <span className="ml-1 text-amber-400">({count})</span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }
    return linkContent;
  }

  /* Sidebar inner content */
  function SidebarContent() {
    return (
      <>
        {/* ── Logo ─────────────────────── */}
        <div
          className={cn(
            "border-b flex items-center gap-3",
            collapsed ? "px-0 py-4 justify-center" : "px-4 py-4"
          )}
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {collapsed ? (
            <button
              onClick={() => setCollapsed(false)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-3 group flex-1 min-w-0">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
                style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold tracking-tight text-white leading-none">ProjectHub</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: "rgba(147,197,253,0.8)" }}>FarmwiseAI</p>
              </div>
            </Link>
          )}

          {/* Collapse toggle — desktop only */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex h-7 w-7 rounded-lg items-center justify-center text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors shrink-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 transition-colors shrink-0 ml-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search / Command Palette ─── */}
        <div className={cn("py-2", collapsed ? "px-2 flex justify-center" : "px-3")}>
          <CommandPaletteTrigger collapsed={collapsed} />
        </div>

        {/* ── Navigation ───────────────── */}
        <nav className={cn("flex-1 py-2 overflow-y-auto", collapsed ? "px-2 space-y-4" : "px-3 space-y-5")}>
          {visibleSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p
                  className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] px-3 mb-1.5"
                  style={{ color: "rgba(148,163,184,0.5)" }}
                >
                  {section.title}
                </p>
              )}
              {collapsed && (
                <div className="h-px mx-1 mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }} />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem key={item.key} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Notification Bell + Theme ── */}
        <div
          className={cn(
            "border-t pt-2 pb-1 space-y-0.5",
            collapsed ? "px-2 flex flex-col items-center" : "px-3"
          )}
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <NotificationBell collapsed={collapsed} />
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* ── User Profile ─────────────── */}
        <div
          className={cn("border-t py-3", collapsed ? "px-2" : "px-3")}
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger>
                <button
                  onClick={handleLogout}
                  className="w-full flex justify-center py-2 rounded-xl hover:bg-red-500/10 group transition-colors"
                >
                  <div className="relative">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                      style={{
                        backgroundColor: user?.avatarColor ?? "#3b82f6",
                        outline: "2px solid rgba(255,255,255,0.15)",
                        outlineOffset: "1px",
                      }}
                    >
                      {user?.initials ?? "R"}
                    </div>
                    <span
                      className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 status-dot-active"
                      style={{ borderColor: "#1e1b4b" }}
                    />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-semibold">{user?.name}</p>
                <p className="text-xs opacity-70">{user?.role} · Sign out</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen((v) => !v);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all group"
              >
                <div className="relative shrink-0">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                    style={{
                      backgroundColor: user?.avatarColor ?? "#3b82f6",
                      boxShadow: `0 0 0 2px rgba(255,255,255,0.12)`,
                    }}
                  >
                    {user?.initials ?? "R"}
                  </div>
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 status-dot-active"
                    style={{ borderColor: "#1a1740" }}
                  />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-100 truncate">
                      {user?.name ?? "Rahul"}
                    </p>
                    <RoleBadge />
                  </div>
                  <p className="text-[11px] truncate" style={{ color: "rgba(148,163,184,0.6)" }}>
                    {user?.department ?? user?.role}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-slate-500 transition-transform duration-200",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden animate-scale-in"
                  style={{
                    background: "#16133d",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
                  }}
                >
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <p className="text-[13px] font-bold text-slate-100">{user?.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>
                      {user?.email}
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-slate-300 hover:bg-white/[0.06] transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  const sidebarBg     = "linear-gradient(180deg, #13112e 0%, #1a1740 50%, #1e1b4b 100%)";
  const sidebarBorder = "rgba(255,255,255,0.06)";

  return (
    <>
      {/* ── Mobile overlay ───────────────────────────────── */}
      {mobileOpen && (
        <div
          className="drawer-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-72 flex flex-col z-50 border-r lg:hidden",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
        style={{ background: sidebarBg, borderColor: sidebarBorder }}
      >
        <SidebarContent />
      </aside>

      {/* ── Desktop / Tablet sidebar ─────────────────────── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-full z-50 border-r",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          collapsed ? "w-[72px]" : "w-64"
        )}
        style={{
          background: sidebarBg,
          borderColor: sidebarBorder,
          boxShadow: "4px 0 32px rgba(0,0,0,0.25)",
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
