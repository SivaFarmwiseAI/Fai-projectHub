"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Activity,
  MessageSquare,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/",            label: "Home",      icon: LayoutDashboard },
  { href: "/projects",   label: "Projects",  icon: FolderKanban },
  { href: "/standup",    label: "Standup",   icon: Activity },
  { href: "/discussions",label: "Discuss",   icon: MessageSquare },
  { href: "/team",       label: "Team",      icon: Users },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden print:hidden">
      {/* Frosted glass bar */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 safe-pb">
        <div className="flex items-stretch h-16">
          {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 rounded-b-full bg-blue-500" />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    isActive
                      ? "text-blue-600 scale-110"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-semibold leading-none transition-colors",
                    isActive
                      ? "text-blue-600"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
