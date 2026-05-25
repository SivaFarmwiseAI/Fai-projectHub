"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isAfter, isBefore } from "date-fns";
import {
  CalendarDays, Plus, Pencil, Trash2, Loader2, Search, FolderKanban, Globe2,
  Clock, CheckCircle2, AlertCircle, XCircle, Send, Hourglass,
} from "lucide-react";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  meetings as meetingsApi,
  projects as projectsApi,
  users as usersApi,
  type Meeting,
  type Project,
  type User,
} from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";
import { showToast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-provider";
import {
  acceptRequest,
  refreshScheduleRequests,
  useScheduleRequestsTick,
} from "@/lib/scheduling-requests";

// ── Datetime helpers ─────────────────────────────────────────────────────────
function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function isoToLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toLocalDatetime(d);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const { isCEO, isAdmin } = useAuth();
  const confirm = useConfirm();
  useScheduleRequestsTick();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<"all" | "upcoming" | "past" | "pending" | "accepted">("upcoming");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "project" | "general">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );

  const load = () => {
    setLoading(true);
    Promise.all([
      meetingsApi.list().then((r) => r.meetings).catch(() => [] as Meeting[]),
      projectsApi.list({ limit: 100 }).then((r) => r.projects).catch(() => [] as Project[]),
      usersApi.list().then((r) => r.users).catch(() => [] as User[]),
    ]).then(([ms, ps, us]) => {
      setMeetings(ms);
      setProjects(ps);
      setUsers(us);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void refreshScheduleRequests(true);
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (q && !m.title.toLowerCase().includes(q) && !(m.project_title ?? "").toLowerCase().includes(q)) return false;
      if (scopeFilter === "project" && !m.project_id) return false;
      if (scopeFilter === "general" && m.project_id) return false;
      const effectiveWhen = m.rescheduled_to ?? m.scheduled_at;
      const whenDate = effectiveWhen ? new Date(effectiveWhen) : null;
      if (filter === "upcoming" && whenDate && isBefore(whenDate, now)) return false;
      if (filter === "past" && whenDate && isAfter(whenDate, now)) return false;
      if (filter === "pending" && m.approval_status !== "pending") return false;
      if (filter === "accepted" && m.approval_status && m.approval_status !== "accepted") return false;
      return true;
    }).sort((a, b) => {
      const aWhen = a.rescheduled_to ?? a.scheduled_at;
      const bWhen = b.rescheduled_to ?? b.scheduled_at;
      return aWhen.localeCompare(bWhen);
    });
  }, [meetings, filter, search, scopeFilter]);

  const counts = useMemo(() => {
    const now = new Date();
    let upcoming = 0, past = 0, pending = 0, accepted = 0;
    for (const m of meetings) {
      const when = m.rescheduled_to ?? m.scheduled_at;
      const whenDate = when ? new Date(when) : null;
      if (whenDate && isAfter(whenDate, now)) upcoming++;
      else if (whenDate) past++;
      if (m.approval_status === "pending") pending++;
      if (m.approval_status === "accepted" || !m.approval_status) accepted++;
    }
    return { upcoming, past, pending, accepted, total: meetings.length };
  }, [meetings]);

  const startNew = () => { setEditing(null); setFormOpen(true); };
  const startEdit = (m: Meeting) => { setEditing(m); setFormOpen(true); };

  const handleDelete = async (m: Meeting) => {
    const ok = await confirm({
      title: "Delete this meeting?",
      description: <><span className="font-medium">{m.title}</span> will be removed.</>,
      confirmLabel: "Delete meeting",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await meetingsApi.delete(m.id);
      showToast.success("Meeting deleted");
      load();
      void refreshScheduleRequests(true);
    } catch (e) {
      showToast.error("Delete failed", e instanceof Error ? e.message : undefined);
    }
  };

  const handleQuickAccept = async (m: Meeting) => {
    try {
      await acceptRequest("meeting", m.id);
      showToast.success("Meeting accepted", "Now visible on the calendar.");
      load();
    } catch (e) {
      showToast.error("Accept failed", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" /> Meetings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Schedule project or general meetings. Every meeting is raised to the CEO — once accepted it appears on the calendar.
          </p>
        </div>
        <Button onClick={startNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Meeting
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Total" value={counts.total} icon={<CalendarDays className="h-4 w-4" />} tone="slate" />
        <StatTile label="Upcoming" value={counts.upcoming} icon={<Clock className="h-4 w-4" />} tone="blue" />
        <StatTile label="Past" value={counts.past} icon={<Clock className="h-4 w-4" />} tone="gray" />
        <StatTile label="Pending CEO" value={counts.pending} icon={<Hourglass className="h-4 w-4" />} tone="amber" />
        <StatTile label="Accepted" value={counts.accepted} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={(v) => v && setScopeFilter(v as typeof scopeFilter)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No meetings match this filter.</p>
            <Button variant="outline" size="sm" onClick={startNew} className="mt-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Schedule a meeting
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              project={m.project_id ? projectMap[m.project_id] : undefined}
              onEdit={() => startEdit(m)}
              onDelete={() => handleDelete(m)}
              canQuickAccept={isCEO || isAdmin}
              onQuickAccept={() => handleQuickAccept(m)}
            />
          ))}
        </div>
      )}

      <MeetingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        projects={projects}
        users={users}
        onSaved={() => { setFormOpen(false); load(); void refreshScheduleRequests(true); }}
      />
    </div>
  );
}

// ── Stat tile ────────────────────────────────────────────────────────────────
function StatTile({
  label, value, icon, tone,
}: { label: string; value: number; icon: React.ReactNode; tone: "slate" | "blue" | "gray" | "amber" | "green" }) {
  const cls = {
    slate: "text-slate-700 bg-slate-50 border-slate-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    gray: "text-gray-700 bg-gray-50 border-gray-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    green: "text-emerald-700 bg-emerald-50 border-emerald-200",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// ── Meeting Row ──────────────────────────────────────────────────────────────
function MeetingRow({
  meeting, project, onEdit, onDelete, canQuickAccept, onQuickAccept,
}: {
  meeting: Meeting;
  project?: Project;
  onEdit: () => void;
  onDelete: () => void;
  canQuickAccept: boolean;
  onQuickAccept: () => void;
}) {
  const effectiveWhen = meeting.rescheduled_to ?? meeting.scheduled_at;
  const status = meeting.approval_status ?? "legacy";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold">{meeting.title}</h3>
              <StatusPill status={status} />
              {project ? (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <FolderKanban className="h-3 w-3" /> {project.title}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] text-slate-500">
                  <Globe2 className="h-3 w-3" /> General
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {effectiveWhen ? format(new Date(effectiveWhen), "EEE, MMM d · h:mm a") : "No time set"}
                {meeting.duration_minutes ? ` · ${meeting.duration_minutes} min` : ""}
              </span>
              {meeting.rescheduled_to && meeting.scheduled_at && meeting.rescheduled_to !== meeting.scheduled_at && (
                <span className="text-amber-600 line-through">
                  was {format(new Date(meeting.scheduled_at), "MMM d · h:mm a")}
                </span>
              )}
              {meeting.created_by_name && <span>· raised by {meeting.created_by_name}</span>}
              {meeting.attendees.length > 0 && (
                <span>· {meeting.attendees.length} attendee{meeting.attendees.length === 1 ? "" : "s"}</span>
              )}
              {meeting.location && <span>· {meeting.location}</span>}
            </div>
            {meeting.agenda && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{meeting.agenda}</p>
            )}
            {meeting.ceo_note && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 mt-2">
                CEO: {meeting.ceo_note}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {canQuickAccept && status === "pending" && (
              <Button size="sm" variant="outline" className="gap-1 h-8 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={onQuickAccept}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Accept
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-200 bg-amber-50 gap-1">
        <Hourglass className="h-3 w-3" /> Pending CEO
      </Badge>
    );
  }
  if (status === "accepted") {
    return (
      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Accepted
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="text-[10px] text-red-700 border-red-200 bg-red-50 gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-200 gap-1">
      <AlertCircle className="h-3 w-3" /> No request
    </Badge>
  );
}

// ── Create / Edit Dialog ─────────────────────────────────────────────────────
function MeetingFormDialog({
  open, onOpenChange, editing, projects, users, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Meeting | null;
  projects: Project[];
  users: User[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<"general" | "project">("general");
  const [projectId, setProjectId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [agenda, setAgenda] = useState("");
  const [location, setLocation] = useState("");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setScope(editing.project_id ? "project" : "general");
      setProjectId(editing.project_id ?? "");
      setScheduledAt(isoToLocal(editing.scheduled_at));
      setDuration(editing.duration_minutes ?? 30);
      setAgenda(editing.agenda ?? "");
      setLocation(editing.location ?? "");
      setAttendeeIds(editing.attendees.map((a) => a.id));
    } else {
      setTitle("");
      setScope("general");
      setProjectId("");
      const def = new Date();
      def.setMinutes(0, 0, 0);
      def.setHours(def.getHours() + 1);
      setScheduledAt(toLocalDatetime(def));
      setDuration(30);
      setAgenda("");
      setLocation("");
      setAttendeeIds([]);
    }
  }, [open, editing]);

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (!title.trim()) { showToast.error("Title required"); return; }
    if (!scheduledAt) { showToast.error("Pick a date and time"); return; }
    if (scope === "project" && !projectId) { showToast.error("Choose a project or switch to General"); return; }
    setSaving(true);
    try {
      const iso = localToIso(scheduledAt);
      if (!iso) {
        showToast.error("Invalid datetime");
        return;
      }
      const payload = {
        title: title.trim(),
        agenda: agenda.trim() || undefined,
        scheduled_at: iso,
        duration_minutes: duration,
        location: location.trim() || undefined,
        project_id: scope === "project" ? projectId : undefined,
        attendee_ids: attendeeIds,
      };
      if (editing) {
        await meetingsApi.update(editing.id, payload);
      } else {
        await meetingsApi.create(payload);
      }
      showToast.success(
        editing ? "Meeting updated" : "Meeting raised to CEO",
        editing && payload.scheduled_at !== editing.scheduled_at
          ? "Re-raised for CEO approval."
          : "Will appear on the calendar once accepted.",
      );
      onSaved();
    } catch (e) {
      showToast.error(editing ? "Failed to update meeting" : "Failed to create meeting", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Meeting" : "New Meeting"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing the time will re-raise this for CEO approval."
              : "This is raised to the CEO. Once accepted, it surfaces on the calendar."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title *</Label>
            <Input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 Engineering Sync"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => v && setScope(v as "general" | "project")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project {scope === "project" && "*"}</Label>
              <Select
                value={projectId}
                onValueChange={(v) => setProjectId(v ?? "")}
                disabled={scope === "general"}
              >
                <SelectTrigger><SelectValue placeholder={scope === "general" ? "—" : "Select project"} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-when">Date &amp; time *</Label>
              <Input
                id="m-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => v && setDuration(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-location">Location / link</Label>
            <Input
              id="m-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference Room A, or https://meet.google.com/…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-agenda">Agenda / notes</Label>
            <Textarea
              id="m-agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="What will be covered?"
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Attendees ({attendeeIds.length})</Label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={attendeeIds.includes(u.id)}
                    onCheckedChange={() => toggleAttendee(u.id)}
                  />
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.name[0]}
                  </div>
                  <span className="text-sm">{u.name}</span>
                  <span className="text-xs text-muted-foreground">— {u.role_type}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {editing ? "Save changes" : "Raise to CEO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
