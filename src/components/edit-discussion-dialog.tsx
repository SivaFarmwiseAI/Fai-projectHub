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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  discussions as discussionsApi,
  projects as projectsApi,
  type Discussion,
  type Project,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discussion: Discussion | null;
  onSaved?: (updated: Discussion) => void;
};

export function EditDiscussionDialog({ open, onOpenChange, discussion, onSaved }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isResolved, setIsResolved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !discussion) return;
    setTitle(discussion.title);
    setProjectId(discussion.project_id ?? "");
    setIsResolved(discussion.is_resolved);
    if (discussion.scheduled_at) {
      const d = new Date(discussion.scheduled_at);
      if (!Number.isNaN(d.getTime())) {
        setScheduledDate(d.toISOString().slice(0, 10));
        setScheduledTime(d.toTimeString().slice(0, 5));
      }
    } else {
      setScheduledDate("");
      setScheduledTime("");
    }
    projectsApi.list({ limit: 50 })
      .then(r => setProjects(r.projects))
      .catch(() => setProjects([]));
  }, [open, discussion]);

  async function handleSave() {
    if (!discussion) return;
    if (!title.trim()) {
      showToast.error("Title required");
      return;
    }
    setSaving(true);
    try {
      let scheduledAt: string | null = null;
      if (scheduledDate) {
        const time = scheduledTime || "09:00";
        scheduledAt = new Date(`${scheduledDate}T${time}`).toISOString();
      }
      const { discussion: updated } = await discussionsApi.update(discussion.id, {
        title: title.trim(),
        project_id: projectId || null,
        scheduled_at: scheduledAt,
        is_resolved: isResolved,
      });
      showToast.success("Discussion updated");
      onSaved?.(updated);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      showToast.error("Failed to save discussion", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Edit Discussion</DialogTitle>
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
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={v => setProjectId(v ?? "")}>
              <SelectTrigger className="h-9 text-sm mt-1">
                <SelectValue placeholder="General" />
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
              <Label className="text-xs">Scheduled Date</Label>
              <Input
                type="date"
                className="h-9 text-sm mt-1"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                className="h-9 text-sm mt-1"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                disabled={!scheduledDate}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isResolved}
              onChange={e => setIsResolved(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Mark as resolved
          </label>

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
