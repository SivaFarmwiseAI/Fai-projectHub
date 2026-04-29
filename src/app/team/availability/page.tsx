"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LeaveAnalytics } from "@/components/leave-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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
  Plane,
  Thermometer,
  Home,
  UserCheck,
  Send,
  MessageCircle,
  Hourglass,
  Zap,
  Link2,
  CircleDot,
} from "lucide-react";
import {
  users as usersApi,
  leave as leaveApi,
  type User,
  type LeaveRequest,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { format } from "date-fns";

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
  const [userList, setUserList] = useState<User[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [expandedLeave, setExpandedLeave] = useState<Set<string>>(new Set());
  const [newLeaveType, setNewLeaveType] = useState<string>("planned");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newCoverage, setNewCoverage] = useState("");
  const [newCoverPerson, setNewCoverPerson] = useState("");
  const [ceoComment, setCeoComment] = useState("");
  const [analyticsUserId, setAnalyticsUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      usersApi.list().then(r => setUserList(r.users)).catch(() => {}),
      leaveApi.list().then(r => setLeaveRequests(r.leave)).catch(() => {}),
    ]);
  }, []);

  const userMap = Object.fromEntries(userList.map(u => [u.id, u]));

  const toggleExpand = (id: string) => {
    setExpandedLeave(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pendingLeaves = leaveRequests.filter(lr => lr.status === "pending");
  const approvedLeaves = leaveRequests.filter(lr => lr.status === "approved");
  const upcomingLeaves = leaveRequests.filter(lr => {
    const start = new Date(lr.start_date).getTime();
    return start >= Date.now() && (lr.status === "approved" || lr.status === "pending");
  });

  // Build a 14-day availability calendar
  const calendarDays: { date: Date; dayLabel: string; users: { userId: string; status: string }[] }[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(Date.now() + i * 86400000);
    const dayLabel = format(date, "EEE d");
    const users = userList.map(u => {
      const lv = leaveRequests.find(lr => {
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

  async function handleSubmitLeave() {
    if (!newStartDate || !newEndDate) {
      showToast.error("Missing dates", "Please select start and end dates.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await leaveApi.create({
        type: newLeaveType,
        start_date: newStartDate,
        end_date: newEndDate,
        reason: newReason,
        cover_person_id: newCoverPerson || undefined,
        coverage_plan: newCoverage || undefined,
        is_planned: newLeaveType === "planned",
      });
      setLeaveRequests(prev => [...prev, result.leave]);
      showToast.success("Leave request submitted!", "Awaiting CEO approval.");
      setShowRequestForm(false);
      setNewReason(""); setNewCoverage(""); setNewStartDate(""); setNewEndDate(""); setNewCoverPerson("");
    } catch {
      showToast.error("Failed to submit leave request", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(lr: LeaveRequest) {
    try {
      await leaveApi.update(lr.id, { status: "approved" });
      setLeaveRequests(prev => prev.map(r => r.id === lr.id ? { ...r, status: "approved" } : r));
      showToast.success("Leave approved", `${userMap[lr.user_id]?.name}'s leave has been approved.`);
      setCeoComment("");
    } catch {
      showToast.error("Failed to approve leave", "Please try again.");
    }
  }

  async function handleReject(lr: LeaveRequest) {
    try {
      await leaveApi.update(lr.id, { status: "rejected" });
      setLeaveRequests(prev => prev.map(r => r.id === lr.id ? { ...r, status: "rejected" } : r));
      showToast.info("Leave rejected", `${userMap[lr.user_id]?.name}'s leave has been rejected.`);
      setCeoComment("");
    } catch {
      showToast.error("Failed to reject leave", "Please try again.");
    }
  }

  const availableToday = userList.length - leaveRequests.filter(lr => {
    const today = new Date();
    const start = new Date(lr.start_date);
    const end = new Date(lr.end_date);
    return today >= start && today <= end && lr.status === "approved" && lr.type !== "wfh";
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto space-y-6">
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
        <Button className="gap-1.5" onClick={() => setShowRequestForm(!showRequestForm)}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </div>

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
            <span className="text-sm text-muted-foreground font-normal">/{userList.length}</span>
          </p>
        </Card>
      </div>

      {/* 14-Day Availability Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" /> Team Availability — Next 14 Days
          </CardTitle>
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
              {userList.map(user => (
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Request Form */}
      {showRequestForm && (
        <Card className="border-blue-200">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" /> New Leave Request
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Leave Type</Label>
                <Select value={newLeaveType} onValueChange={(v) => v && setNewLeaveType(v)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="wfh">Work from Home</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" className="h-8 text-xs mt-1" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input type="date" className="h-8 text-xs mt-1" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Reason</Label>
              <Input className="h-8 text-xs mt-1" placeholder="Why do you need this leave?" value={newReason} onChange={e => setNewReason(e.target.value)} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h5 className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Impact Analysis
              </h5>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><CircleDot className="h-3 w-3 text-amber-600" /><span>Checking your active tasks and milestones...</span></p>
                <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-amber-600" /><span>Analyzing dependency chains for downstream impact...</span></p>
                <p className="flex items-center gap-1.5"><Users className="h-3 w-3 text-amber-600" /><span>Checking team availability for coverage...</span></p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Coverage Plan <span className="text-muted-foreground">(Who will handle your work?)</span></Label>
              <Textarea className="text-xs min-h-[50px] mt-1" placeholder="Describe who will cover your tasks and how..." value={newCoverage} onChange={e => setNewCoverage(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">Cover Person</Label>
              <Select value={newCoverPerson} onValueChange={(v) => v && setNewCoverPerson(v)}>
                <SelectTrigger className="h-8 text-xs mt-1 w-[200px]"><SelectValue placeholder="Select teammate..." /></SelectTrigger>
                <SelectContent>
                  {userList.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-1" onClick={handleSubmitLeave} disabled={submitting}>
                <Send className="h-3.5 w-3.5" /> Submit for Approval
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Leave Requests — CEO Action Needed */}
      {pendingLeaves.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Action Required — Pending Leave Requests
          </h3>
          {pendingLeaves.map(lr => {
            const user = userMap[lr.user_id];
            const coverPerson = lr.cover_person_id ? userMap[lr.cover_person_id] : null;

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
                        className={`ml-1 p-1 rounded-md transition-colors ${
                          analyticsUserId === lr.user_id
                            ? "bg-violet-100 text-violet-600"
                            : "text-gray-400 hover:bg-violet-50 hover:text-violet-500"
                        }`}
                        title={`View leave analytics for ${user?.name}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDate(lr.created_at)}</span>
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
                        {coverPerson && <span className="normal-case font-normal"> — {coverPerson.name}</span>}
                      </h5>
                      <p className="text-xs text-muted-foreground">{lr.coverage_plan}</p>
                    </div>
                  )}

                  {analyticsUserId === lr.user_id && (
                    <LeaveAnalytics userId={lr.user_id} onClose={() => setAnalyticsUserId(null)} />
                  )}

                  <Separator />
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-blue-600" /> CEO Decision
                    </h5>
                    <Textarea
                      placeholder="Add comment (optional)..."
                      className="text-xs min-h-[50px]"
                      value={ceoComment}
                      onChange={e => setCeoComment(e.target.value)}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" onClick={() => handleApprove(lr)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-1" onClick={() => handleReject(lr)}>
                        <ShieldX className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approved & Past Leaves */}
      {approvedLeaves.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Approved Leaves
          </h3>
          {approvedLeaves
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
            .map(lr => {
              const user = userMap[lr.user_id];
              const coverPerson = lr.cover_person_id ? userMap[lr.cover_person_id] : null;
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
                      {coverPerson && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                          <UserCheck className="h-3 w-3" /> Cover: {coverPerson.name}
                        </span>
                      )}
                      {isPast && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">Past</Badge>
                      )}
                      <button
                        onClick={() => setAnalyticsUserId(analyticsUserId === lr.user_id ? null : lr.user_id)}
                        className={`p-1 rounded-md transition-colors ${
                          analyticsUserId === lr.user_id
                            ? "bg-violet-100 text-violet-600"
                            : "text-gray-400 hover:bg-violet-50 hover:text-violet-500"
                        }`}
                        title={`View leave analytics for ${user?.name}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
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

      {/* No leaves state */}
      {leaveRequests.length === 0 && (
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
