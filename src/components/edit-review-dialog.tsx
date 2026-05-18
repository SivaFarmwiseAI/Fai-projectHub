"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  reviews as reviewsApi,
  users as usersApi,
  projects as projectsApi,
  type ReviewTask,
  type User,
  type Project,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: ReviewTask | null;
  onSaved?: (updated: ReviewTask) => void;
};

export function EditReviewDialog({ open, onOpenChange, review, onSaved }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("document");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !review) return;
    setTitle(review.title);
    setDescription(review.description ?? "");
    setType(review.type);
    setPriority(review.priority);
    setStatus(review.status);
    setAssigneeId(review.assignee_id ?? "");
    setProjectId(review.project_id ?? "");
    setDueDate(review.due_date ? review.due_date.slice(0, 10) : "");
    Promise.all([
      usersApi.list().then(r => r.users).catch(() => [] as User[]),
      projectsApi.list({ limit: 50 }).then(r => r.projects).catch(() => [] as Project[]),
    ]).then(([u, p]) => {
      setUsers(u);
      setProjects(p);
    });
  }, [open, review]);

  async function handleSave() {
    if (!review) return;
    if (!title.trim()) {
      showToast.error("Title required");
      return;
    }
    setSaving(true);
    try {
      const { review: updated } = await reviewsApi.update(review.id, {
        title: title.trim(),
        description,
        priority,
        status,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || undefined,
      });
      showToast.success("Review updated");
      onSaved?.(updated);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to save review", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Edit Review Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              className="h-9 text-sm mt-1"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              className="text-sm min-h-[60px] mt-1"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={v => v && setType(v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={v => v && setPriority(v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Assignee</Label>
              <Select value={assigneeId} onValueChange={v => setAssigneeId(v ?? "")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="Unassigned" />
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
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                className="h-9 text-sm mt-1"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
