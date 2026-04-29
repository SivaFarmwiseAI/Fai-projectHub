"use client";

import Link from "next/link";
import {
  User,
  ShieldCheck,
  Bell,
  Palette,
  ChevronRight,
  Building2,
  Mail,
  Briefcase,
  Lock,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

/* ── Role colour helpers ──────────────────────────────────── */
const ROLE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Admin:       { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  CEO:         { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  "Team Lead": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Member:      { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200" },
};

/* ── Setting row ─────────────────────────────────────────── */
function SettingRow({
  icon: Icon,
  label,
  value,
  description,
  href,
  badge,
  locked,
}: {
  icon: typeof User;
  label: string;
  value?: string;
  description?: string;
  href?: string;
  badge?: string;
  locked?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-4 rounded-xl transition-all",
        href
          ? "hover:bg-slate-50 cursor-pointer group"
          : "cursor-default"
      )}
    >
      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {badge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-700 bg-blue-50">
              {badge}
            </Badge>
          )}
          {locked && (
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Lock className="h-3 w-3" /> read-only
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {value && (
        <span className="text-sm text-slate-500 truncate max-w-[180px] shrink-0">{value}</span>
      )}
      {href && (
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

/* ── Section card ─────────────────────────────────────────── */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-200/60">
        <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-slate-100">{children}</CardContent>
    </Card>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { user, isCEO, isAdmin } = useAuth();

  if (!user) return null;

  const roleStyle = ROLE_STYLES[user.roleType] ?? ROLE_STYLES["Member"];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account preferences and application configuration.
        </p>
      </div>

      {/* ── Profile card ── */}
      <Card className="overflow-hidden border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          {/* Profile hero */}
          <div className="px-5 py-5 flex items-center gap-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white shadow-md shrink-0"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-extrabold text-slate-900">{user.name}</p>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    roleStyle.bg, roleStyle.text, roleStyle.border
                  )}
                >
                  {user.roleType}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{user.email}</p>
            </div>
          </div>

          {/* Profile details */}
          <div className="divide-y divide-slate-100">
            <SettingRow icon={Mail}      label="Email"      value={user.email}              locked />
            <SettingRow icon={Briefcase} label="Role"       value={user.role}               locked />
            {user.department && (
              <SettingRow icon={Building2} label="Department" value={user.department}        locked />
            )}
            <SettingRow icon={ShieldCheck} label="Access Level" value={user.roleType}       locked />
          </div>
        </CardContent>
      </Card>

      {/* ── Appearance ── */}
      <SettingsSection title="Appearance">
        <SettingRow
          icon={Palette}
          label="Theme"
          description="Light and dark mode can be toggled from the sidebar."
          value="System default"
        />
      </SettingsSection>

      {/* ── Notifications ── */}
      <SettingsSection title="Notifications">
        <SettingRow
          icon={Bell}
          label="In-app Notifications"
          description="Badge counts for reviews and AI capture items."
          value="Enabled"
        />
      </SettingsSection>

      {/* ── Admin — shown to CEO and Admin ── */}
      {(isCEO || isAdmin) && (
        <SettingsSection title="Administration">
          <SettingRow
            icon={ShieldCheck}
            label="Menu Access Control"
            description="Configure which navigation items each role can see."
            href="/settings/menu-access"
            badge="Admin"
          />
        </SettingsSection>
      )}

      {/* ── About ── */}
      <SettingsSection title="About">
        <SettingRow
          icon={Info}
          label="ProjectHub"
          description="AI-powered project management for FarmwiseAI teams."
          value="v1.0.0"
        />
      </SettingsSection>

      <Separator />
      <p className="text-center text-xs text-slate-400 pb-2">
        ProjectHub · FarmwiseAI · {new Date().getFullYear()}
      </p>
    </div>
  );
}
