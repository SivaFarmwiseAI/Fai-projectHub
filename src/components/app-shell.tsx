"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, Sparkles, Bell } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar, SidebarContext } from "@/components/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { analytics as analyticsApi } from "@/lib/api-client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/error-boundary";

const PUBLIC_ROUTES = ["/login"];

/* ── Page title map ─────────────────────────────────────────── */
const PAGE_TITLES: Record<string, string> = {
  "/":                          "Command Center",
  "/calendar":                  "Calendar",
  "/projects":                  "Projects",
  "/projects/new":              "New Project",
  "/reviews":                   "Review Queue",
  "/team":                      "Team",
  "/team/manage":               "Manage Team",
  "/team/availability":         "Leave & Availability",
  "/capture":                   "AI Capture",
  "/standup":                   "Daily Standup",
  "/discussions":               "Discussions",
  "/settings":                  "Settings",
  "/settings/menu-access":      "Menu Access",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/projects/")) return "Project Detail";
  if (pathname.startsWith("/team/"))     return "Team Member";
  return "ProjectHub";
}

/* ── Mobile Top Bar ─────────────────────────────────────────── */
function MobileTopBar({
  onMenuClick,
  sidebarCollapsed,
}: {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
}) {
  const pathname     = usePathname();
  const { user }     = useAuth();
  const [reviewCount, setReviewCount]   = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const totalBadge   = reviewCount + captureCount;

  useEffect(() => {
    analyticsApi.dashboard().then(r => {
      setReviewCount(r.stats.pending_reviews);
      setCaptureCount(r.stats.pending_captures);
    }).catch(() => {});
  }, []);
  const title        = getPageTitle(pathname);

  return (
    <header
      className="animate-topbar sticky top-0 z-30 lg:hidden flex items-center gap-3 px-4 h-[60px] bg-white/95 border-b shadow-topbar"
      style={{ borderColor: "rgba(59,130,246,0.08)" }}
    >
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo + title */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <p className="text-[14px] font-bold text-slate-900 truncate">{title}</p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {totalBadge > 0 && (
          <Link href="/reviews">
            <div className="relative">
              <Bell className="h-5 w-5 text-slate-400" />
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-amber-500 text-[9px] font-bold text-white flex items-center justify-center border-2 border-white">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            </div>
          </Link>
        )}
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-blue-200"
          style={{ backgroundColor: user?.avatarColor ?? "#3b82f6" }}
        >
          {user?.initials ?? "R"}
        </div>
      </div>
    </header>
  );
}

/* ── Main AppShell ──────────────────────────────────────────── */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, isPublicRoute, router]);

  // Prevent body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  if (isPublicRoute) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-5">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-glow-blue"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}
          >
            <Sparkles className="h-7 w-7 text-white animate-float" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[15px] font-bold text-slate-800">ProjectHub</p>
            <p className="text-sm text-slate-400 animate-pulse">Loading your command center…</p>
          </div>
          <div className="flex gap-1.5">
            {[0,1,2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <TooltipProvider>
        <Sidebar />

        {/* Main area */}
        <div
          className={cn(
            "flex flex-col flex-1 min-h-screen transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            /* Desktop: leave room for fixed sidebar */
            "lg:ml-64",
          )}
        >
          {/* Mobile top bar */}
          <MobileTopBar onMenuClick={() => setMobileOpen(true)} />

          {/* Page content */}
          <main className="flex-1 overflow-auto bg-grid-pattern">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-10 pb-24 lg:pb-10">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}
