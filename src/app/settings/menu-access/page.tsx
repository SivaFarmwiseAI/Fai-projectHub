"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Save,
  RotateCcw,
  Info,
  Lock,
  CheckSquare2,
  Square,
  LayoutDashboard,
  FolderKanban,
  Plus,
  ClipboardCheck,
  Users,
  UserPlus,
  CalendarDays,
  Calendar,
  Sparkles,
  BarChart3,
  FileText,
  GanttChart,
  LayoutTemplate,
  Activity,
  MessageSquare,
  Settings,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { useMenuAccess } from "@/contexts/menu-access-context";
import { showToast } from "@/lib/toast";
import { SECTION_ORDER, type RoleType, type MenuItemConfig } from "@/lib/menu-access";
import { cn } from "@/lib/utils";

/* ── Icon map ─────────────────────────────────────────────── */
const ITEM_ICONS: Record<string, typeof LayoutDashboard> = {
  "command-center":     LayoutDashboard,
  "ceo-briefing":       FileText,
  "analytics":          BarChart3,
  "ceo-calendar":       Calendar,
  "my-calendar":        Calendar,
  "all-projects":       FolderKanban,
  "new-project":        Plus,
  "timeline":           GanttChart,
  "templates":          LayoutTemplate,
  "daily-standup":      Activity,
  "discussions":        MessageSquare,
  "review-queue":       ClipboardCheck,
  "team":               Users,
  "manage-team":        UserPlus,
  "leave-availability": CalendarDays,
  "ai-capture":         Sparkles,
  "settings":           Settings,
  "menu-access":        ShieldCheck,
};

/* ── Role display config ──────────────────────────────────── */
const ROLES: RoleType[] = ["Admin", "CEO", "Team Lead", "Member"];

const ROLE_CONFIG: Record<RoleType, { color: string; bg: string; border: string; dot: string }> = {
  Admin:       { color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200", dot: "bg-orange-500" },
  CEO:         { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500" },
  "Team Lead": { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",dot: "bg-emerald-500" },
  Member:      { color: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200",   dot: "bg-pink-500" },
};

/* ── Section colour accent ────────────────────────────────── */
const SECTION_ACCENTS: Record<string, string> = {
  Overview: "text-blue-600",
  Projects: "text-violet-600",
  Work:     "text-amber-600",
  Team:     "text-emerald-600",
  AI:       "text-purple-600",
  Settings: "text-slate-600",
};

/* ── Preview panel: shows what a role's menu looks like ─────── */
function RolePreview({
  role,
  items,
}: {
  role: RoleType;
  items: MenuItemConfig[];
}) {
  const rc = ROLE_CONFIG[role];
  const visible = items.filter((i) => i.allowedRoles.includes(role));
  const sections = SECTION_ORDER
    .map((s) => ({ title: s, items: visible.filter((i) => i.section === s) }))
    .filter((s) => s.items.length > 0);

  return (
    <div
      className={cn(
        "rounded-xl border p-3 min-w-[160px] flex-1",
        rc.bg, rc.border
      )}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span className={cn("h-2 w-2 rounded-full", rc.dot)} />
        <p className={cn("text-xs font-bold", rc.color)}>{role}</p>
        <span className="ml-auto text-[10px] text-slate-500">{visible.length} items</span>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {section.title}
            </p>
            <div className="space-y-0.5 pl-1">
              {section.items.map((item) => {
                const Icon = ITEM_ICONS[item.key] ?? LayoutDashboard;
                return (
                  <div key={item.key} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <Icon className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function MenuAccessPage() {
  const { isCEO, isAdmin } = useAuth();
  const router = useRouter();
  const { menuItems, toggleRole, setItemRoles, saveConfig, resetConfig, hasUnsavedChanges } =
    useMenuAccess();

  const [showPreview, setShowPreview] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("all");

  // Guard: CEO and Admin only
  useEffect(() => {
    if (!isCEO && !isAdmin) {
      router.replace("/settings");
    }
  }, [isCEO, isAdmin, router]);

  if (!isCEO && !isAdmin) return null;

  /* Group items by section */
  const sections = SECTION_ORDER.map((s) => ({
    title: s,
    items: menuItems.filter((i) => i.section === s),
  })).filter((s) => s.items.length > 0);

  const displayedSections =
    activeSection === "all"
      ? sections
      : sections.filter((s) => s.title === activeSection);

  function handleSave() {
    saveConfig();
    showToast.success("Saved", "Menu access configuration updated.");
  }

  function handleReset() {
    if (!confirm("Reset all menu access back to defaults?")) return;
    resetConfig();
    showToast.info("Reset", "Menu access restored to defaults.");
  }

  /* Select-all / deselect-all for a section × role */
  function sectionAllChecked(sectionItems: MenuItemConfig[], role: RoleType) {
    return sectionItems
      .filter((i) => !i.locked)
      .every((i) => i.allowedRoles.includes(role));
  }

  function toggleSectionRole(sectionItems: MenuItemConfig[], role: RoleType) {
    const nonLocked = sectionItems.filter((i) => !i.locked);
    const allOn = sectionAllChecked(sectionItems, role);
    nonLocked.forEach((item) => {
      const has = item.allowedRoles.includes(role);
      if (allOn && has) {
        setItemRoles(item.key, item.allowedRoles.filter((r) => r !== role));
      } else if (!allOn && !has) {
        setItemRoles(item.key, [...item.allowedRoles, role]);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Settings
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Menu Access Control
              </h1>
              <p className="text-sm text-slate-500">
                Configure which navigation items each role can see.
              </p>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="gap-1.5 text-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={cn(
              "gap-1.5 text-xs transition-all",
              hasUnsavedChanges
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                : ""
            )}
          >
            <Save className="h-3.5 w-3.5" />
            {hasUnsavedChanges ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
        <p>
          Changes apply immediately in the sidebar after saving. Items marked{" "}
          <Lock className="h-3.5 w-3.5 inline mb-0.5" /> are <strong>locked</strong> and cannot be
          changed.
        </p>
      </div>

      {/* ── Role legend ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {ROLES.map((role) => {
          const rc = ROLE_CONFIG[role];
          return (
            <div
              key={role}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold",
                rc.bg, rc.border, rc.color
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", rc.dot)} />
              {role}
            </div>
          );
        })}
      </div>

      {/* ── Section filter tabs ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveSection("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            activeSection === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          )}
        >
          All Sections
        </button>
        {SECTION_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeSection === s
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Access matrix ── */}
      <div className="space-y-4">
        {displayedSections.map((section) => {
          const sectionAccent = SECTION_ACCENTS[section.title] ?? "text-slate-600";
          return (
            <Card key={section.title} className="overflow-hidden border-slate-200/80 shadow-sm">
              {/* Section header row */}
              <CardHeader className="px-5 py-3 bg-slate-50/70 border-b border-slate-200/60">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className={cn("text-xs font-extrabold uppercase tracking-widest", sectionAccent)}
                  >
                    {section.title}
                  </CardTitle>
                  {/* Column-level select-all for each role */}
                  <div className="flex items-center gap-6 pr-1">
                    {ROLES.map((role) => {
                      const rc = ROLE_CONFIG[role];
                      const allOn = sectionAllChecked(section.items, role);
                      const hasLocked = section.items.some((i) => i.locked);
                      const allLocked = section.items.every((i) => i.locked);
                      return (
                        <div key={role} className="flex flex-col items-center gap-1 w-16">
                          <span className={cn("text-[9px] font-bold", rc.color)}>{role}</span>
                          {allLocked ? (
                            <Lock className="h-3.5 w-3.5 text-slate-300" />
                          ) : (
                            <button
                              onClick={() => toggleSectionRole(section.items, role)}
                              title={`${allOn ? "Deselect" : "Select"} all ${role} in ${section.title}`}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
                            >
                              {allOn ? (
                                <CheckSquare2 className={cn("h-4 w-4", rc.color)} />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {hasLocked && !allLocked && (
                            <span className="text-[8px] text-slate-400">some locked</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>

              {/* Menu item rows */}
              <CardContent className="p-0">
                {section.items.map((item, idx) => {
                  const Icon = ITEM_ICONS[item.key] ?? LayoutDashboard;
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        "flex items-center gap-4 px-5 py-3.5 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        "hover:bg-blue-50/30",
                        idx < section.items.length - 1 && "border-b border-slate-100"
                      )}
                    >
                      {/* Icon + label */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {item.label}
                            </p>
                            {item.locked && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400 shrink-0">
                                <Lock className="h-3 w-3" /> locked
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate">{item.href}</p>
                        </div>
                      </div>

                      {/* Default roles badges */}
                      <div className="hidden sm:flex items-center gap-1 shrink-0 w-[130px]">
                        {(item.defaultRoles === "all"
                          ? ROLES
                          : item.defaultRoles
                        ).map((r) => {
                          const rc = ROLE_CONFIG[r];
                          return (
                            <span
                              key={r}
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded-full border",
                                rc.bg, rc.color, rc.border
                              )}
                            >
                              {r === "Team Lead" ? "Lead" : r}
                            </span>
                          );
                        })}
                      </div>

                      {/* Role checkboxes */}
                      <div className="flex items-center gap-6 shrink-0 pr-1">
                        {ROLES.map((role) => {
                          const rc = ROLE_CONFIG[role];
                          const checked = item.allowedRoles.includes(role);
                          return (
                            <div key={role} className="w-16 flex justify-center">
                              {item.locked ? (
                                <div
                                  className={cn(
                                    "h-4.5 w-4.5 rounded border-2 flex items-center justify-center",
                                    checked
                                      ? cn(rc.bg, rc.border)
                                      : "bg-slate-100 border-slate-200"
                                  )}
                                >
                                  {checked && (
                                    <svg
                                      viewBox="0 0 10 10"
                                      className={cn("h-2.5 w-2.5", rc.color)}
                                      fill="currentColor"
                                    >
                                      <path d="M8.5 2L4 7.5 1.5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                                    </svg>
                                  )}
                                </div>
                              ) : (
                                <Checkbox
                                  id={`${item.key}-${role}`}
                                  checked={checked}
                                  onCheckedChange={() => toggleRole(item.key, role)}
                                  className={cn(
                                    "h-4.5 w-4.5 transition-all",
                                    checked
                                      ? cn(rc.bg, "border-2", rc.border)
                                      : ""
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Live role preview ── */}
      {showPreview && (
        <>
          <Separator />
          <div>
            <h2 className="text-sm font-bold text-slate-700 mb-1">Live Role Preview</h2>
            <p className="text-xs text-slate-500 mb-4">
              This shows the exact sidebar menu each role would see with the current (unsaved) settings.
            </p>
            <div className="flex gap-3 flex-wrap">
              {ROLES.map((role) => (
                <RolePreview key={role} role={role} items={menuItems} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom save bar (sticky) ── */}
      {hasUnsavedChanges && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700">
            <p className="text-sm font-semibold">You have unsaved changes.</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-slate-300 hover:text-white hover:bg-white/10 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
