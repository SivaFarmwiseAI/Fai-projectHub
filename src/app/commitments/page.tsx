"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Handshake,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Save,
  Send,
  CalendarRange,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  commitments as commitmentsApi,
  users as usersApi,
  projects as projectsApi,
  type Commitment,
  type User,
  type Project,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-provider";
import { refreshScheduleRequests } from "@/lib/scheduling-requests";
import { COMMITMENT_STATUS_LABELS, COMMITMENT_PRIORITY_LABELS } from "@/lib/labels";

const statusColors: Record<string, string> = {
  pending:     "text-amber-700 border-amber-200 bg-amber-50",
  in_progress: "text-blue-700 border-blue-200 bg-blue-50",
  completed:   "text-emerald-700 border-emerald-200 bg-emerald-50",
  cancelled:   "text-slate-700 border-slate-200 bg-slate-50",
};

const priorityColors: Record<string, string> = {
  high:   "text-red-700 border-red-200 bg-red-50",
  medium: "text-amber-700 border-amber-200 bg-amber-50",
  low:    "text-slate-700 border-slate-200 bg-slate-50",
};

export default function CommitmentsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<Commitment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Commitment | null>(null);
  const [viewing, setViewing] = useState<Commitment | null>(null);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  async function loadAll() {
    setLoading(true);
    try {
      const [c, u, p] = await Promise.all([
        commitmentsApi.list().then(r => r.commitments).catch(() => [] as Commitment[]),
        usersApi.list().then(r => r.users).catch(() => [] as User[]),
        projectsApi.list({ limit: 50 }).then(r => r.projects).catch(() => [] as Project[]),
      ]);
      setItems(c);
      setUsers(u);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    return items.filter(c =>
      (filterStatus === "all" || c.status === filterStatus) &&
      (filterPriority === "all" || c.priority === filterPriority)
    );
  }, [items, filterStatus, filterPriority]);

  async function handleDelete(c: Commitment) {
    const ok = await confirm({
      title: "Delete commitment?",
      description: <><span className="font-medium">{c.title}</span> will be permanently removed.</>,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await commitmentsApi.delete(c.id);
      setItems(prev => prev.filter(x => x.id !== c.id));
      showToast.success("Commitment deleted");
    } catch (e) {
      showToast.error("Delete failed", e instanceof Error ? e.message : "Try again");
    }
  }

  async function handleView(c: Commitment) {
    try {
      const { commitment } = await commitmentsApi.get(c.id);
      setViewing(commitment);
    } catch {
      setViewing(c);
    }
  }

  function handleCreated(c: Commitment) {
    setItems(prev => [c, ...prev]);
  }
  function handleUpdated(c: Commitment) {
    setItems(prev => prev.map(x => x.id === c.id ? c : x));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Handshake className="h-7 w-7 text-indigo-600" />
            Commitments
          </h1>
          <p className="text-muted-foreground mt-1">
            Promises with a date window — visible on the CEO calendar across their active days.
          </p>
        </div>
        <Button className="gap-1.5 self-start" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Commitment
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? "all")}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue>
              {({ all: "All Statuses", pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" } as Record<string, string>)[filterStatus] ?? filterStatus}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={v => setFilterPriority(v ?? "all")}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue>
              {({ all: "All Priorities", high: "High", medium: "Medium", low: "Low" } as Record<string, string>)[filterPriority] ?? filterPriority}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16 text-muted-foreground">
            <Handshake className="h-10 w-10 mx-auto mb-3 text-indigo-300" />
            <p className="font-medium">No commitments yet.</p>
            <p className="text-sm mt-1">Click <span className="font-semibold">New Commitment</span> to add one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <CommitmentCard
              key={c.id}
              c={c}
              onView={() => handleView(c)}
              onEdit={() => setEditTarget(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      <CommitmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        projects={projects}
        onSaved={handleCreated}
      />
      <CommitmentFormDialog
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        users={users}
        projects={projects}
        commitment={editTarget ?? undefined}
        onSaved={handleUpdated}
      />
      <ViewCommitmentDialog
        commitment={viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
      />
    </div>
  );
}

function CommitmentCard({
  c, onView, onEdit, onDelete,
}: {
  c: Commitment;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start gap-3">
          <Handshake className="h-4 w-4 text-indigo-500 mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-sm">{c.title}</h3>
              <Badge variant="outline" className={statusColors[c.status] ?? ""}>
                {COMMITMENT_STATUS_LABELS[c.status] ?? c.status}
              </Badge>
              <Badge variant="outline" className={priorityColors[c.priority] ?? ""}>
                {COMMITMENT_PRIORITY_LABELS[c.priority] ?? c.priority}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
                <CalendarRange className="h-3 w-3" />
                {format(new Date(c.from_date), "MMM d")} → {format(new Date(c.to_date), "MMM d, yyyy")}
              </span>
              {c.assignee_name && <span>Assigned: {c.assignee_name}</span>}
              {c.owner_name && <span>By: {c.owner_name}</span>}
              {c.project_title && <span>Project: {c.project_title}</span>}
            </div>
            {c.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{c.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onView} title="View">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommitmentFormDialog({
  open, onOpenChange, users, projects, commitment, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  users: User[];
  projects: Project[];
  commitment?: Commitment;
  onSaved: (c: Commitment) => void;
}) {
  const isEdit = !!commitment;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(commitment?.title ?? "");
    setDescription(commitment?.description ?? "");
    setFromDate(commitment?.from_date?.slice(0, 10) ?? "");
    setToDate(commitment?.to_date?.slice(0, 10) ?? "");
    setPriority(commitment?.priority ?? "medium");
    setStatus(commitment?.status ?? "pending");
    setAssigneeId(commitment?.assignee_id ?? "");
    setProjectId(commitment?.project_id ?? "");
  }, [open, commitment]);

  async function handleSubmit() {
    if (!title.trim()) {
      showToast.error("Title required");
      return;
    }
    if (!fromDate || !toDate) {
      showToast.error("Pick from and to dates");
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      showToast.error("Invalid range", "To date must be on or after from date");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && commitment) {
        const { commitment: updated } = await commitmentsApi.update(commitment.id, {
          title: title.trim(),
          description,
          from_date: fromDate,
          to_date: toDate,
          priority,
          status,
          assignee_id: assigneeId || undefined,
          project_id: projectId || undefined,
        });
        showToast.success("Commitment updated");
        onSaved(updated);
      } else {
        const { commitment: created } = await commitmentsApi.create({
          title: title.trim(),
          description,
          from_date: fromDate,
          to_date: toDate,
          priority,
          status,
          assignee_id: assigneeId || undefined,
          project_id: projectId || undefined,
        });
        void refreshScheduleRequests(true);
        showToast.success("Commitment raised to CEO", "Pending approval before it hits the calendar.");
        onSaved(created);
      }
      onOpenChange(false);
    } catch (e) {
      showToast.error(isEdit ? "Update failed" : "Create failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-indigo-600" />
            {isEdit ? "Edit Commitment" : "New Commitment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title <span className="text-red-500">*</span></Label>
            <Input
              className="h-9 text-sm mt-1"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What are you committing to?"
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              className="text-sm min-h-[60px] mt-1"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional context…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                className="h-9 text-sm mt-1 cursor-pointer"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                className="h-9 text-sm mt-1 cursor-pointer"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Priority</Label>
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
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => v && setStatus(v)}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue>
                    {({ pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" } as Record<string, string>)[status] ?? status}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Assignee</Label>
              <Select value={assigneeId} onValueChange={v => setAssigneeId(v ?? "")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Unassigned">
                    {assigneeId ? (users.find(u => u.id === assigneeId)?.name ?? "Unassigned") : "Unassigned"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} — {u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Project</Label>
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
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isEdit ? <Save className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />)}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewCommitmentDialog({
  commitment, onOpenChange,
}: {
  commitment: Commitment | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={!!commitment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-indigo-600" />
            Commitment Details
          </DialogTitle>
        </DialogHeader>
        {commitment && (
          <div className="px-1 pb-2 space-y-5">
            {/* Title + description */}
            <div className="space-y-1.5">
              <p className="text-lg font-bold text-slate-900 leading-snug">{commitment.title}</p>
              {commitment.description && (
                <p className="text-sm text-slate-500 whitespace-pre-line leading-relaxed">{commitment.description}</p>
              )}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100">
              <CalendarRange className="h-4 w-4 text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-indigo-700">
                {format(new Date(commitment.from_date), "MMM d, yyyy")}
              </span>
              <span className="text-indigo-400 font-bold">→</span>
              <span className="text-sm font-semibold text-indigo-700">
                {format(new Date(commitment.to_date), "MMM d, yyyy")}
              </span>
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
                <Badge variant="outline" className={`w-fit ${statusColors[commitment.status] ?? ""}`}>
                  {COMMITMENT_STATUS_LABELS[commitment.status] ?? commitment.status}
                </Badge>
              </div>
              <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Priority</span>
                <Badge variant="outline" className={`w-fit ${priorityColors[commitment.priority] ?? ""}`}>
                  {COMMITMENT_PRIORITY_LABELS[commitment.priority] ?? commitment.priority}
                </Badge>
              </div>
            </div>

            {/* People + Project */}
            <div className="space-y-2.5">
              {(commitment.owner_name || commitment.assignee_name) && (
                <div className="grid grid-cols-2 gap-3">
                  {commitment.owner_name && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Owner</span>
                      <span className="text-sm font-medium text-slate-800">{commitment.owner_name}</span>
                    </div>
                  )}
                  {commitment.assignee_name && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Assigned to</span>
                      <span className="text-sm font-medium text-slate-800">{commitment.assignee_name}</span>
                    </div>
                  )}
                </div>
              )}
              {commitment.project_title && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Project</span>
                  <span className="text-sm font-medium text-slate-800">{commitment.project_title}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
