"use client";

import { useEffect, useState } from "react";
import { Plane, ClipboardCheck, MessageSquare, CalendarDays, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  leave as leaveApi,
  reviews as reviewsApi,
  discussions as discussionsApi,
  projects as projectsApi,
  users as usersApi,
  type Project,
  type User,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { refreshScheduleRequests } from "@/lib/scheduling-requests";
import { REVIEW_TYPE_LABELS } from "@/lib/labels";

export type ScheduleTab = "leave" | "review" | "discussion";

// Local YYYY-MM-DD — used as the date-picker `min` so past dates can't be picked.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ScheduleTab;
  /** Called once a create succeeds so the parent can refresh data. */
  onCreated?: () => void;
};

export function ScheduleDialog({
  open,
  onOpenChange,
  defaultTab = "leave",
  onCreated,
}: Props) {
  const [tab, setTab] = useState<ScheduleTab>(defaultTab);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    if (!open) return;
    // Reset to caller's requested tab and refetch lookups every time the
    // dialog opens — defaultTab differs across trigger sites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(defaultTab);
    Promise.all([
      projectsApi.list({ limit: 50 }).then(r => r.projects).catch(() => [] as Project[]),
      usersApi.list().then(r => r.users).catch(() => [] as User[]),
    ]).then(([projs, usrs]) => {
      setProjectList(projs);
      setUserList(usrs);
    });
  }, [open, defaultTab]);

  const close = () => onOpenChange(false);
  const success = (msg: string, detail?: string) => {
    showToast.success(msg, detail);
    onCreated?.();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Schedule on Calendar
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Raise a leave, review task, or discussion — all surface on the CEO calendar.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => v && setTab(v as ScheduleTab)} className="px-6 pt-3">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="leave" className="gap-1.5">
              <Plane className="h-3.5 w-3.5" /> Leave
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" /> Review
            </TabsTrigger>
            <TabsTrigger value="discussion" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Discussion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leave" className="pt-4 pb-5">
            <LeaveForm users={userList} onClose={close} onSuccess={success} />
          </TabsContent>
          <TabsContent value="review" className="pt-4 pb-5">
            <ReviewForm
              users={userList}
              projects={projectList}
              onClose={close}
              onSuccess={success}
            />
          </TabsContent>
          <TabsContent value="discussion" className="pt-4 pb-5">
            <DiscussionForm projects={projectList} onClose={close} onSuccess={success} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Leave form ───────── */
function LeaveForm({
  users,
  onClose,
  onSuccess,
}: {
  users: User[];
  onClose: () => void;
  onSuccess: (msg: string, detail?: string) => void;
}) {
  const [type, setType] = useState("planned");
  const [duration, setDuration] = useState<"full" | "half">("full");
  const [halfPeriod, setHalfPeriod] = useState<"first" | "second">("first");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [coverPerson, setCoverPerson] = useState("");
  const [coveragePlan, setCoveragePlan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!startDate || !endDate) {
      showToast.error("Missing dates", "Pick a start and end date.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      showToast.error("Invalid range", "End date must be after start date.");
      return;
    }
    setSubmitting(true);
    try {
      // The backend records a half-day as type "half_day" (0.5-day calc);
      // full-day leave keeps the chosen category (planned/sick/…).
      const effectiveType = duration === "half" ? "half_day" : type;
      // The leave API has no half-period field, so note it in the reason.
      const halfLabel = halfPeriod === "first" ? "First half" : "Second half";
      const effectiveReason =
        duration === "half"
          ? reason ? `${halfLabel} — ${reason}` : halfLabel
          : reason;
      await leaveApi.create({
        type: effectiveType,
        start_date: startDate,
        end_date: endDate,
        reason: effectiveReason,
        cover_person_id: coverPerson || undefined,
        coverage_plan: coveragePlan || undefined,
        is_planned: type === "planned",
      });
      void refreshScheduleRequests(true);
      onSuccess("Leave request raised to CEO", "Pending approval before it hits the calendar.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to raise leave", msg);
    } finally {
      setSubmitting(false);
    }
  }

  const todayStr = todayISO();
  const invalidRange = !!(startDate && endDate && endDate < startDate);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Type <span className="text-red-500">*</span></Label>
          <Select value={type} onValueChange={v => v && setType(v)}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue>
                {({ planned: "Planned", sick: "Sick", personal: "Personal", wfh: "Work from Home" } as Record<string, string>)[type] ?? type}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="sick">Sick</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="wfh">Work from Home</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Start <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            min={todayStr}
            className="h-9 text-sm mt-1 cursor-pointer"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            onMouseDown={e => { e.preventDefault(); (e.currentTarget as HTMLInputElement).showPicker?.(); }}
          />
        </div>
        <div>
          <Label className="text-xs">End <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            min={startDate || todayStr}
            className={`h-9 text-sm mt-1 cursor-pointer${invalidRange ? " border-red-400 focus-visible:ring-red-200" : ""}`}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            onMouseDown={e => { e.preventDefault(); (e.currentTarget as HTMLInputElement).showPicker?.(); }}
          />
        </div>
      </div>

      {invalidRange && (
        <p className="text-xs font-medium text-red-600">
          End date cannot be earlier than the start date. Please select a valid date range.
        </p>
      )}

      <div>
        <Label className="text-xs">Duration <span className="text-red-500">*</span></Label>
        <div className="flex items-center gap-3 mt-1.5">
          {([
            { value: "full", label: "Full Day" },
            { value: "half", label: "Half Day" },
          ] as const).map(opt => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                duration === opt.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-slate-600 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="leave-duration"
                value={opt.value}
                checked={duration === opt.value}
                onChange={() => {
                  setDuration(opt.value);
                  if (opt.value === "half") setHalfPeriod("first");
                }}
                className="h-4 w-4 accent-blue-600 cursor-pointer"
              />
              {opt.label}
            </label>
          ))}
        </div>

        {duration === "half" && (
          <div className="mt-2.5 max-w-[220px] animate-fade-in-up">
            <Select value={halfPeriod} onValueChange={v => v && setHalfPeriod(v as "first" | "second")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>
                  {halfPeriod === "first" ? "First Half" : "Second Half"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First Half</SelectItem>
                <SelectItem value="second">Second Half</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">Reason</Label>
        <Input
          className="h-9 text-sm mt-1"
          placeholder="Why do you need this leave?"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Cover Person</Label>
          <Select value={coverPerson} onValueChange={v => setCoverPerson(v ?? "")}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue placeholder="Optional">
                {coverPerson ? (users.find(u => u.id === coverPerson)?.name ?? "Optional") : "Optional"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Coverage Plan</Label>
          <Input
            className="h-9 text-sm mt-1"
            placeholder="How will work continue?"
            value={coveragePlan}
            onChange={e => setCoveragePlan(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={submitting || invalidRange} className="gap-1.5">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Submit Request
        </Button>
      </div>
    </div>
  );
}

/* ───────── Review form ───────── */
function ReviewForm({
  users,
  projects,
  onClose,
  onSuccess,
}: {
  users: User[];
  projects: Project[];
  onClose: () => void;
  onSuccess: (msg: string, detail?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("document");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) {
      showToast.error("Title required", "Give this review a name.");
      return;
    }
    setSubmitting(true);
    try {
      await reviewsApi.create({
        title: title.trim(),
        description: description || undefined,
        type,
        priority,
        assignee_id: assigneeId || undefined,
        project_id: projectId || undefined,
        due_date: dueDate || undefined,
      });
      void refreshScheduleRequests(true);
      onSuccess("Review raised to CEO", dueDate ? `Proposed due ${dueDate}` : "Awaiting CEO approval.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to schedule review", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Title <span className="text-red-500">*</span></Label>
        <Input
          className="h-9 text-sm mt-1"
          placeholder="What needs reviewing?"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea
          className="text-sm min-h-[60px] mt-1"
          placeholder="Add context for the reviewer…"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Type <span className="text-red-500">*</span></Label>
          <Select value={type} onValueChange={v => v && setType(v)}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue>
                {REVIEW_TYPE_LABELS[type] ?? type}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="code">Code</SelectItem>
              <SelectItem value="architecture">Architecture</SelectItem>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="notebook">Notebook</SelectItem>
              <SelectItem value="demo">Demo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Priority <span className="text-red-500">*</span></Label>
          <Select value={priority} onValueChange={v => v && setPriority(v)}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue>
                {({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[priority] ?? priority}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Due Date</Label>
          <Input
            type="date"
            min={todayISO()}
            className="h-9 text-sm mt-1 cursor-pointer"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            onMouseDown={e => { e.preventDefault(); (e.currentTarget as HTMLInputElement).showPicker?.(); }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Assignee</Label>
          <Select value={assigneeId} onValueChange={v => setAssigneeId(v ?? "")}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue placeholder="Pick a reviewer">
                {assigneeId ? (users.find(u => u.id === assigneeId)?.name ?? "Pick a reviewer") : "Pick a reviewer"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Project (optional)</Label>
          <Select value={projectId} onValueChange={v => setProjectId(v ?? "")}>
            <SelectTrigger className="h-9 text-sm mt-1">
              <SelectValue placeholder="No project">
                {projectId ? (projects.find(p => p.id === projectId)?.title ?? "No project") : "No project"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={submitting} className="gap-1.5">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Schedule Review
        </Button>
      </div>
    </div>
  );
}

/* ───────── Discussion form ───────── */
function DiscussionForm({
  projects,
  onClose,
  onSuccess,
}: {
  projects: Project[];
  onClose: () => void;
  onSuccess: (msg: string, detail?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!title.trim()) {
      showToast.error("Title required", "Give this discussion a name.");
      return;
    }
    setSubmitting(true);
    try {
      let scheduledAt: string | undefined;
      if (scheduledDate) {
        const time = scheduledTime || "09:00";
        scheduledAt = new Date(`${scheduledDate}T${time}`).toISOString();
      }
      await discussionsApi.create({
        title: title.trim(),
        project_id: projectId || undefined,
        scheduled_at: scheduledAt,
      });
      void refreshScheduleRequests(true);
      onSuccess(
        "Discussion raised to CEO",
        scheduledAt ? `Proposed for ${scheduledDate}` : "Open thread — CEO approval pending.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to create discussion", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Title <span className="text-red-500">*</span></Label>
        <Input
          className="h-9 text-sm mt-1"
          placeholder="What do we need to discuss?"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">Project (optional)</Label>
        <Select value={projectId} onValueChange={v => setProjectId(v ?? "")}>
          <SelectTrigger className="h-9 text-sm mt-1">
            <SelectValue placeholder="General">
              {projectId ? (projects.find(p => p.id === projectId)?.title ?? "General") : "General"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Scheduled Date (optional)</Label>
          <Input
            type="date"
            min={todayISO()}
            className="h-9 text-sm mt-1 cursor-pointer"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            onMouseDown={e => { e.preventDefault(); (e.currentTarget as HTMLInputElement).showPicker?.(); }}
          />
        </div>
        <div>
          <Label className="text-xs">Time</Label>
          <Input
            type="time"
            className="h-9 text-sm mt-1 cursor-pointer"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
            disabled={!scheduledDate}
            onClick={e => !scheduledDate ? undefined : (e.currentTarget as HTMLInputElement).showPicker?.()}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Leave the date blank to start an open thread that surfaces on today&apos;s calendar.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={submitting} className="gap-1.5">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Schedule Discussion
        </Button>
      </div>
    </div>
  );
}
