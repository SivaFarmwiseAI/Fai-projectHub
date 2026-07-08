"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LeaveAnalytics } from "@/components/leave-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  Users,
  Eye,
  EyeOff,
  Plane,
  Thermometer,
  Home,
  UserCheck,
  Hourglass,
  Search,
} from "lucide-react";
import { ScheduleDialog } from "@/components/schedule-dialog";
import {
  users as usersApi,
  leave as leaveApi,
  type User,
  type LeaveRequest,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-provider";
import { useAuth } from "@/contexts/auth-context";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────

function Avatar({ user, size = "sm" }: { user?: User; size?: "sm" | "md" | "lg" }) {
  if (!user) return null;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : size === "md" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: user.avatar_color }}
      title={`${user.name} — ${user.role}`}
    >
      {user.name.charAt(0)}
    </div>
  );
}

function formatDate(d: string) {
  return format(new Date(d), "MMM d, yyyy");
}

function formatShortDate(d: string) {
  return format(new Date(d), "MMM d");
}

const leaveTypeLabels: Record<string, string> = {
  planned: "Planned Leave",
  sick: "Sick Leave",
  personal: "Personal",
  wfh: "Work from Home",
  half_day: "Half Day",
};

const leaveTypeColors: Record<string, string> = {
  planned: "text-blue-700 border-blue-200 bg-blue-50",
  sick: "text-red-700 border-red-200 bg-red-50",
  personal: "text-purple-700 border-purple-200 bg-purple-50",
  wfh: "text-teal-700 border-teal-200 bg-teal-50",
  half_day: "text-amber-700 border-amber-200 bg-amber-50",
};

const leaveTypeIcons: Record<string, React.ReactNode> = {
  planned: <Plane className="h-3.5 w-3.5" />,
  sick: <Thermometer className="h-3.5 w-3.5" />,
  personal: <CalendarDays className="h-3.5 w-3.5" />,
  wfh: <Home className="h-3.5 w-3.5" />,
  half_day: <Clock className="h-3.5 w-3.5" />,
};

const statusColors: Record<string, string> = {
  pending: "text-amber-700 border-amber-200 bg-amber-50",
  approved: "text-emerald-700 border-emerald-200 bg-emerald-50",
  rejected: "text-red-700 border-red-200 bg-red-50",
};

// ─── Page ─────────────────────────────────────────────────

export default function LeaveAvailabilityPage() {
  const { user: authUser, isCEO, isAdmin, isLead, isLeadership } = useAuth();
  const confirm = useConfirm();
  const [userList, setUserList] = useState<User[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [analyticsUserId, setAnalyticsUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadLeaveData() {
    await Promise.all([
      usersApi.list().then(r => setUserList(r.users)).catch(() => { }),
      leaveApi.list().then(r => setLeaveRequests(r.leave)).catch(() => { }),
    ]);
  }

  useEffect(() => {
    loadLeaveData();
  }, []);

  const userMap = Object.fromEntries(userList.map(u => [u.id, u]));

  // ── Role-based visibility ──────────────────────────────────
  //  CEO / Admin / Leadership → all employees
  //  Team Lead                → direct reports (manager_id = me) + myself
  //  Member                   → only myself
  const canSeeEveryone = isCEO || isAdmin || isLeadership;
  const visibleUsers = useMemo(() => {
    if (canSeeEveryone) return userList;
    if (isLead) return userList.filter(u => u.manager_id === authUser?.id || u.id === authUser?.id);
    return userList.filter(u => u.id === authUser?.id);
  }, [userList, canSeeEveryone, isLead, authUser?.id]);

  const visibleIds = useMemo(() => new Set(visibleUsers.map(u => u.id)), [visibleUsers]);
  // Leave data is scoped server-side too; this mirror keeps the UI consistent
  // even before the backend deploy lands and against any stale cache.
  const scopedLeave = useMemo(
    () => leaveRequests.filter(lr => visibleIds.has(lr.user_id)),
    [leaveRequests, visibleIds],
  );

  const pendingLeaves = scopedLeave.filter(lr => lr.status === "pending");
  const approvedLeaves = scopedLeave.filter(lr => lr.status === "approved");
  const upcomingLeaves = scopedLeave.filter(lr => {
    const start = new Date(lr.start_date).getTime();
    return start >= Date.now() && (lr.status === "approved" || lr.status === "pending");
  });

  // ── Real-time search (within the role-scoped set) ──────────
  const q = search.trim().toLowerCase();
  const searchedUsers = useMemo(
    () => (q ? visibleUsers.filter(u => u.name.toLowerCase().includes(q)) : visibleUsers),
    [visibleUsers, q],
  );
  const nameOf = (lr: LeaveRequest) =>
    (userMap[lr.user_id]?.name ?? lr.user_name ?? "").toLowerCase();
  const matchesSearch = (lr: LeaveRequest) => !q || nameOf(lr).includes(q);
  const shownPending = pendingLeaves.filter(matchesSearch);
  const shownApproved = approvedLeaves.filter(matchesSearch);
  const rejectedLeaves = scopedLeave.filter(lr => lr.status === "rejected");
  const shownRejected = rejectedLeaves.filter(matchesSearch);

  // Who may approve/reject a given request:
  //   CEO / Admin / Leadership → anyone; Team Lead → their direct reports only.
  const canApprove = (lr: LeaveRequest) => {
    if (isCEO || isAdmin || isLeadership) return true;
    if (isLead) return userMap[lr.user_id]?.manager_id === authUser?.id;
    return false;
  };

  // Build a 14-day availability calendar
  const calendarDays: { date: Date; dayLabel: string; users: { userId: string; status: string }[] }[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.now() + i * 86400000);
    const dayLabel = format(date, "EEE d");
    const users = visibleUsers.map(u => {
      const lv = scopedLeave.find(lr => {
        const start = new Date(lr.start_date).getTime();
        const end = new Date(lr.end_date).getTime();
        return lr.user_id === u.id && date.getTime() >= start - 86400000 && date.getTime() <= end + 86400000 && lr.status !== "rejected";
      });
      if (lv) {
        return { userId: u.id, status: lv.type === "wfh" ? "wfh" : lv.type === "half_day" ? "half_day" : "on_leave" };
      }
      return { userId: u.id, status: "available" };
    });
    calendarDays.push({ date, dayLabel, users });
  }

  const availabilityColors: Record<string, string> = {
    available: "bg-emerald-500",
    on_leave: "bg-red-500",
    wfh: "bg-teal-500",
    half_day: "bg-amber-500",
  };

  async function handleApprove(lr: LeaveRequest) {
    try {
      await leaveApi.update(lr.id, { status: "approved" });
      setLeaveRequests(prev => prev.map(r => r.id === lr.id ? { ...r, status: "approved", rejection_reason: undefined } : r));
      showToast.success("Leave approved", `${userMap[lr.user_id]?.name ?? lr.user_name} has been notified.`);
      setRejectingId(null);
      setRejectReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to approve leave", msg);
    }
  }

  async function handleReject(lr: LeaveRequest) {
    const reason = rejectReason.trim();
    try {
      await leaveApi.update(lr.id, { status: "rejected", rejection_reason: reason || undefined });
      setLeaveRequests(prev => prev.map(r => r.id === lr.id ? { ...r, status: "rejected", rejection_reason: reason || undefined } : r));
      showToast.info("Leave rejected", `${userMap[lr.user_id]?.name ?? lr.user_name} has been notified.`);
      setRejectingId(null);
      setRejectReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to reject leave", msg);
    }
  }

  async function handleCancelOrDelete(lr: LeaveRequest) {
    const isOwn = authUser?.id === lr.user_id;
    if (!isOwn && !isAdmin && !isCEO) {
      showToast.error("Not allowed", "You can only cancel your own leave requests.");
      return;
    }
    const ok = await confirm({
      title: "Remove leave request?",
      description: `This ${lr.type.replace("_", " ")} leave entry will be deleted.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await leaveApi.delete(lr.id);
      setLeaveRequests(prev => prev.filter(r => r.id !== lr.id));
      showToast.success("Leave request removed", "The leave entry has been deleted.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to remove leave", msg);
    }
  }

  const availableToday = visibleUsers.length - scopedLeave.filter(lr => {
    const today = new Date();
    const start = new Date(lr.start_date);
    const end = new Date(lr.end_date);
    return today >= start && today <= end && lr.status === "approved" && lr.type !== "wfh";
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/team" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-500" /> Leave & Availability
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage team leaves, see upcoming absences, and plan coverage
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setScheduleOpen(true)}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </div>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        defaultTab="leave"
        onCreated={loadLeaveData}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Pending Approval</span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${pendingLeaves.length > 0 ? "text-amber-600" : ""}`}>{pendingLeaves.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Upcoming Leaves</span>
          </div>
          <p className="text-2xl font-bold mt-1">{upcomingLeaves.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Approved</span>
          </div>
          <p className="text-2xl font-bold mt-1">{approvedLeaves.length}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Available Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {availableToday}
            <span className="text-sm text-muted-foreground font-normal">/{visibleUsers.length}</span>
          </p>
        </Card>
      </div>

      {/* 14-Day Availability Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" /> Team Availability — Next 14 Days
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employees…"
                className="h-8 pl-8 pr-8 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {q && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {searchedUsers.length} of {visibleUsers.length} shown
            </p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 inline-block" /> Available</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500 inline-block" /> On Leave</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500 inline-block" /> WFH</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" /> Half Day</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `100px repeat(14, 1fr)` }}>
                <div className="text-[10px] text-muted-foreground p-1" />
                {calendarDays.map((day, i) => {
                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                  return (
                    <div key={i} className={`text-[10px] text-center p-1 ${isWeekend ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                      {day.dayLabel}
                    </div>
                  );
                })}
              </div>
              {searchedUsers.map(user => (
                <div key={user.id} className="grid gap-0.5" style={{ gridTemplateColumns: `100px repeat(14, 1fr)` }}>
                  <div className="flex items-center gap-1.5 p-1">
                    <Avatar user={user} size="sm" />
                    <span className="text-xs truncate">{user.name}</span>
                  </div>
                  {calendarDays.map((day, i) => {
                    const userDay = day.users.find(u => u.userId === user.id);
                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                    const status = isWeekend ? "weekend" : (userDay?.status || "available");
                    const bgColor = isWeekend ? "bg-muted/20" : availabilityColors[status] || "bg-emerald-500";
                    return (
                      <div
                        key={i}
                        className={`h-8 rounded-sm ${isWeekend ? bgColor : `${bgColor}/30 hover:${bgColor}/50`} cursor-default transition-colors flex items-center justify-center`}
                        title={`${user.name} — ${isWeekend ? "Weekend" : status.replace("_", " ")}`}
                      >
                        {status === "on_leave" && <Plane className="h-3 w-3 text-red-600" />}
                        {status === "wfh" && <Home className="h-3 w-3 text-teal-600" />}
                        {status === "half_day" && <Clock className="h-3 w-3 text-amber-600" />}
                      </div>
                    );
                  })}
                </div>
              ))}
              {searchedUsers.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">
                  No employees match &ldquo;{search}&rdquo;.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Leave Requests — CEO Action Needed */}
      {shownPending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Action Required — Pending Leave Requests
          </h3>
          {shownPending.map(lr => {
            const user = userMap[lr.user_id];
            const coverNames = lr.cover_person_names?.length
              ? lr.cover_person_names.join(", ")
              : (lr.cover_person_id ? userMap[lr.cover_person_id]?.name : null);

            return (
              <Card key={lr.id} className="border-amber-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar user={user} size="md" />
                      <div>
                        <p className="text-sm font-medium">{user?.name ?? lr.user_name}</p>
                        <p className="text-[10px] text-muted-foreground">{user?.role}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${leaveTypeColors[lr.type]}`}>
                        {leaveTypeIcons[lr.type]} <span className="ml-1">{leaveTypeLabels[lr.type]}</span>
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${statusColors[lr.status]}`}>Pending</Badge>
                      <button
                        onClick={() => setAnalyticsUserId(analyticsUserId === lr.user_id ? null : lr.user_id)}
                        className={`ml-1 p-1 rounded-md transition-colors ${analyticsUserId === lr.user_id
                            ? "bg-violet-100 text-violet-600"
                            : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                          }`}
                        title={analyticsUserId === lr.user_id ? "Hide leave summary" : `View leave summary for ${user?.name}`}
                      >
                        {analyticsUserId === lr.user_id ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDate(lr.created_at)}</span>
                    {(authUser?.id === lr.user_id || isAdmin || isCEO) && (
                      <button
                        onClick={() => handleCancelOrDelete(lr)}
                        className="ml-1 p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Cancel / delete leave"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
                      <span className="font-medium">{formatShortDate(lr.start_date)} — {formatShortDate(lr.end_date)}</span>
                      <span className="text-muted-foreground">({lr.days} day{lr.days !== 1 ? "s" : ""})</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{lr.reason}</p>

                  {lr.coverage_plan && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                      <h5 className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" /> Coverage Plan
                        {coverNames && <span className="normal-case font-normal"> — {coverNames}</span>}
                      </h5>
                      <p className="text-xs text-muted-foreground">{lr.coverage_plan}</p>
                    </div>
                  )}

                  {analyticsUserId === lr.user_id && (
                    <LeaveAnalytics userId={lr.user_id} onClose={() => setAnalyticsUserId(null)} />
                  )}

                  {canApprove(lr) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-blue-600" /> Approval Decision
                        </h5>
                        {rejectingId === lr.id ? (
                          <div className="space-y-2">
                            <Textarea
                              autoFocus
                              placeholder="Reason for rejection (optional)…"
                              className="text-xs min-h-[60px] border-red-200 focus-visible:ring-red-200"
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white gap-1"
                                onClick={() => handleReject(lr)}
                              >
                                <ShieldX className="h-3.5 w-3.5" /> Confirm Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setRejectingId(null); setRejectReason(""); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => handleApprove(lr)}>
                              <ShieldCheck className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 gap-1"
                              onClick={() => { setRejectingId(lr.id); setRejectReason(""); }}
                            >
                              <ShieldX className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approved & Past Leaves */}
      {shownApproved.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Approved Leaves
          </h3>
          {shownApproved
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .map(lr => {
              const user = userMap[lr.user_id];
              const coverNames = lr.cover_person_names?.length
                ? lr.cover_person_names.join(", ")
                : (lr.cover_person_id ? userMap[lr.cover_person_id]?.name : null);
              const isPast = new Date(lr.end_date).getTime() < Date.now();

              return (
                <Card key={lr.id} className={`${isPast ? "opacity-60" : ""} border-emerald-200`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar user={user} size="sm" />
                      <span className="text-sm font-medium">{user?.name ?? lr.user_name}</span>
                      <Badge variant="outline" className={`text-[10px] ${leaveTypeColors[lr.type]}`}>
                        {leaveTypeLabels[lr.type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatShortDate(lr.start_date)}{lr.days > 1 ? ` — ${formatShortDate(lr.end_date)}` : ""} ({lr.days}d)
                      </span>
                      {coverNames && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                          <UserCheck className="h-3 w-3" /> Cover: {coverNames}
                        </span>
                      )}
                      {isPast && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">Past</Badge>
                      )}
                      <button
                        onClick={() => setAnalyticsUserId(analyticsUserId === lr.user_id ? null : lr.user_id)}
                        className={`p-1 rounded-md transition-colors ${analyticsUserId === lr.user_id
                            ? "bg-violet-100 text-violet-600"
                            : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                          }`}
                        title={analyticsUserId === lr.user_id ? "Hide leave summary" : `View leave summary for ${user?.name}`}
                      >
                        {analyticsUserId === lr.user_id ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      {(authUser?.id === lr.user_id || isAdmin || isCEO) && (
                        <button
                          onClick={() => handleCancelOrDelete(lr)}
                          className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Cancel / delete leave"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 ml-9">{lr.reason}</p>
                    {analyticsUserId === lr.user_id && (
                      <div className="mt-2">
                        <LeaveAnalytics userId={lr.user_id} onClose={() => setAnalyticsUserId(null)} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Rejected Leaves — with the mandatory reason shown back to the member */}
      {shownRejected.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShieldX className="h-4 w-4 text-red-600" /> Rejected Leaves
          </h3>
          {shownRejected
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(lr => {
              const user = userMap[lr.user_id];
              return (
                <Card key={lr.id} className="border-red-200 opacity-90">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar user={user} size="sm" />
                      <span className="text-sm font-medium">{user?.name ?? lr.user_name}</span>
                      <Badge variant="outline" className={`text-[10px] ${leaveTypeColors[lr.type]}`}>
                        {leaveTypeLabels[lr.type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatShortDate(lr.start_date)}{lr.days > 1 ? ` — ${formatShortDate(lr.end_date)}` : ""} ({lr.days}d)
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${statusColors.rejected}`}>Rejected</Badge>
                      {(authUser?.id === lr.user_id || isAdmin || isCEO) && (
                        <button
                          onClick={() => handleCancelOrDelete(lr)}
                          className="p-1 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-auto"
                          title="Delete leave"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {lr.reason && (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-9">{lr.reason}</p>
                    )}
                    {lr.rejection_reason && (
                      <div className="mt-2 ml-9 bg-red-50 border border-red-200 rounded-lg p-2">
                        <h5 className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-0.5 flex items-center gap-1">
                          <ShieldX className="h-3 w-3" /> Rejection Reason
                        </h5>
                        <p className="text-xs text-red-700">{lr.rejection_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* No leaves state */}
      {scopedLeave.length === 0 && (
        <Card className="p-8 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No leave requests yet. Team is fully available!
          </p>
        </Card>
      )}
    </div>
  );
}
