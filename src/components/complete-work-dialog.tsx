"use client";

/**
 * Structured completion dialog for tasks and milestones.
 *
 * Enforces (mirroring the server-side gate in the tasks handler):
 *  - a task WITH milestones completes only after every milestone is completed
 *    (each milestone carries its own outcome + evidence) — no task-level
 *    outcome is demanded;
 *  - a milestone, or a task WITHOUT milestones, completes only with an
 *    outcome verdict (met / partially met / not met / deferred), outcome
 *    notes, and at least one piece of deliverable evidence (file, link or
 *    text) unless evidence is already on record.
 */

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  Loader2,
  ListChecks,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
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
  ApiError,
  tasks as tasksApi,
  uploads as uploadsApi,
  type DeliverableInput,
  type OutcomeVerdict,
  type Task,
  type TaskMilestone,
} from "@/lib/api-client";
import { OUTCOME_VERDICT_LABELS } from "@/lib/labels";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Props = {
  entity: "task" | "milestone";
  taskId: string;
  /** Required when entity === "milestone". */
  milestoneId?: string;
  /** Task/milestone title shown in the header. */
  title: string;
  /** Task mode only: milestone completion counts drive the blocked/confirm views. */
  milestonesGate?: { total: number; completed: number };
  /** Prefill for the first evidence row's type (milestone.deliverable_type). */
  defaultDeliverableType?: string;
  /** When evidence is already on record, new evidence becomes optional. */
  hasExistingDeliverable?: boolean;
  showHours?: boolean;
  defaultHours?: number;
  /** What this work was expected to produce — shown as guidance. */
  expectedDeliverable?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (updated: Task | TaskMilestone) => void;
};

type EvidenceMode = "link" | "file" | "text";

type EvidenceDraft = {
  _key: string;
  type: string;
  title: string;
  mode: EvidenceMode;
  url: string;
  text_content: string;
  _uploading?: boolean;
  _fileName?: string;
  _uploadError?: string;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const DELIVERABLE_TYPES: { value: string; label: string }[] = [
  { value: "document",      label: "Document" },
  { value: "code",          label: "Code / PR" },
  { value: "ppt",           label: "Presentation" },
  { value: "text",          label: "Write-up" },
  { value: "meeting_notes", label: "Meeting notes" },
  { value: "data",          label: "Data / Report" },
];

const VERDICTS: { value: OutcomeVerdict; hint: string; active: string }[] = [
  { value: "met",           hint: "Delivered as planned",   active: "border-emerald-500 bg-emerald-50 text-emerald-700" },
  { value: "partially_met", hint: "Delivered with gaps",    active: "border-amber-500 bg-amber-50 text-amber-700" },
  { value: "not_met",       hint: "Goal was not achieved",  active: "border-rose-500 bg-rose-50 text-rose-700" },
  { value: "deferred",      hint: "Moved to later work",    active: "border-slate-400 bg-slate-100 text-slate-700" },
];

const ERROR_CODE_TOASTS: Record<string, [string, string]> = {
  MILESTONES_INCOMPLETE:  ["Milestones still open", "Complete every milestone before completing the task."],
  OUTCOME_REQUIRED:       ["Outcome required", "Pick a verdict — Met, Partially met, Not met or Deferred."],
  OUTCOME_NOTES_REQUIRED: ["Outcome notes required", "Describe what this work delivered."],
  DELIVERABLE_REQUIRED:   ["Deliverable required", "Attach a file, link or text as evidence."],
};

const emptyEvidence = (type: string): EvidenceDraft => ({
  _key: Math.random().toString(36).slice(2),
  type,
  title: "",
  mode: "link",
  url: "",
  text_content: "",
});

export function CompleteWorkDialog({
  entity,
  taskId,
  milestoneId,
  title,
  milestonesGate,
  defaultDeliverableType,
  hasExistingDeliverable,
  showHours,
  defaultHours,
  expectedDeliverable,
  open,
  onOpenChange,
  onCompleted,
}: Props) {
  const gated = entity === "task" && (milestonesGate?.total ?? 0) > 0;
  const gateBlocked = gated && (milestonesGate!.completed < milestonesGate!.total);

  const [verdict, setVerdict] = useState<OutcomeVerdict | null>(null);
  const [notes, setNotes] = useState("");
  const [hours, setHours] = useState<string>("");
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setVerdict(null);
    setNotes("");
    setHours(defaultHours != null ? String(defaultHours) : "");
    setEvidence(
      gated || hasExistingDeliverable
        ? []
        : [emptyEvidence(defaultDeliverableType || "document")],
    );
    setSaving(false);
    // Reset only when the dialog opens for a (possibly different) target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, milestoneId]);

  const updateEvidence = (key: string, patch: Partial<EvidenceDraft>) =>
    setEvidence((prev) => prev.map((e) => (e._key === key ? { ...e, ...patch } : e)));

  const handleFilePicked = async (key: string, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      updateEvidence(key, { _uploadError: "File too large — max 8 MB", _fileName: file.name });
      showToast.error("File too large", "Maximum upload size is 8 MB");
      return;
    }
    updateEvidence(key, { _uploading: true, _fileName: file.name, _uploadError: undefined });
    try {
      const url = await uploadsApi.uploadFileSmart(file);
      setEvidence((prev) =>
        prev.map((e) =>
          e._key === key
            ? {
                ...e,
                url,
                title: e.title.trim() ? e.title : file.name,
                _uploading: false,
                _fileName: file.name,
                _uploadError: undefined,
              }
            : e,
        ),
      );
    } catch (err) {
      let msg = "Upload failed — please try again";
      if (err instanceof ApiError) {
        if (err.status === 503) msg = "File upload is not configured on the server";
        else if (err.status === 413) msg = "File too large — max 8 MB";
        else msg = err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      updateEvidence(key, { _uploading: false, _uploadError: msg });
      showToast.error("Upload failed", msg);
    }
  };

  const cleanedEvidence = (): DeliverableInput[] =>
    evidence
      .filter((e) => e.title.trim() && (e.mode === "text" ? e.text_content.trim() : e.url.trim()))
      .map((e) => ({
        type: e.type,
        title: e.title.trim(),
        url: e.mode === "text" ? undefined : e.url.trim(),
        text_content: e.mode === "text" ? e.text_content.trim() : undefined,
      }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (gateBlocked) return;

    const items = cleanedEvidence();
    if (!gated) {
      if (!verdict) {
        showToast.warning("Pick an outcome verdict", "Met, Partially met, Not met or Deferred.");
        return;
      }
      if (!notes.trim()) {
        showToast.warning("Outcome notes required", "Describe what this work delivered.");
        return;
      }
      if (evidence.some((e) => e._uploading)) {
        showToast.warning("An upload is still in progress — please wait.");
        return;
      }
      if (items.length === 0 && !hasExistingDeliverable) {
        showToast.warning("Deliverable required", "Attach a file, link or text as evidence.");
        return;
      }
    }

    const parsedHours = hours.trim() === "" ? undefined : Number(hours);
    if (parsedHours != null && (Number.isNaN(parsedHours) || parsedHours < 0)) {
      showToast.warning("Invalid hours", "Working hours must be a positive number.");
      return;
    }

    setSaving(true);
    try {
      if (entity === "milestone") {
        const res = await tasksApi.updateMilestone(taskId, milestoneId!, {
          status: "completed",
          outcome: verdict!,
          outcome_notes: notes.trim(),
          ...(showHours && parsedHours != null ? { actual_hours: parsedHours } : {}),
          ...(items.length ? { deliverables: items } : {}),
        });
        onCompleted(res.milestone);
      } else {
        const res = await tasksApi.update(taskId, {
          status: "completed",
          ...(gated
            ? {}
            : { outcome: verdict!, outcome_notes: notes.trim() }),
          ...(showHours && parsedHours != null ? { actual_hours: parsedHours } : {}),
          ...(items.length ? { deliverables: items } : {}),
        });
        onCompleted(res.task);
      }
      showToast.success(entity === "task" ? "Task completed" : "Milestone completed");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code && ERROR_CODE_TOASTS[err.code]) {
        const [t, d] = ERROR_CODE_TOASTS[err.code];
        showToast.error(t, d);
      } else {
        showToast.error(
          "Could not complete",
          err instanceof Error ? err.message : "Please try again",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Complete {entity === "task" ? "task" : "milestone"} · {title}
          </DialogTitle>
        </DialogHeader>

        {gateBlocked ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <ListChecks className="h-4 w-4" />
                {milestonesGate!.completed} of {milestonesGate!.total} milestones done
              </div>
              <p className="mt-1.5 text-xs text-amber-700">
                Each milestone records its own outcome and deliverable. Complete
                the remaining {milestonesGate!.total - milestonesGate!.completed}{" "}
                milestone{milestonesGate!.total - milestonesGate!.completed === 1 ? "" : "s"}{" "}
                first — then the task can be closed.
              </p>
            </div>
            <DialogFooter className="!px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
            {gated ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  All {milestonesGate!.total} milestones completed
                </div>
                <p className="mt-1.5 text-xs text-emerald-700">
                  Every milestone has its outcome and deliverable on record — no
                  extra evidence is needed to close this task.
                </p>
              </div>
            ) : (
              <>
                {expectedDeliverable && (
                  <p className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                    <span className="font-semibold">Expected deliverable:</span>{" "}
                    {expectedDeliverable}
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label>
                    Outcome <span className="text-rose-500">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {VERDICTS.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVerdict(v.value)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-center transition-colors",
                          verdict === v.value
                            ? v.active
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        <span className="block text-xs font-semibold">
                          {OUTCOME_VERDICT_LABELS[v.value]}
                        </span>
                        <span className="mt-0.5 block text-[10px] opacity-70">{v.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cw-notes">
                    Outcome notes <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="cw-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={`What did this ${entity} deliver? Results, links to context, anything a reviewer should know.`}
                    rows={3}
                  />
                </div>
              </>
            )}

            {showHours && (
              <div className="space-y-1.5">
                <Label htmlFor="cw-hours">Actual working hours</Label>
                <Input
                  id="cw-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g. 12"
                  className="max-w-[160px]"
                />
              </div>
            )}

            {!gated && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Deliverable evidence{" "}
                    {hasExistingDeliverable ? (
                      <span className="text-[11px] font-normal text-emerald-600">
                        · deliverable already on record
                      </span>
                    ) : (
                      <span className="text-rose-500">*</span>
                    )}
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEvidence((prev) => [
                        ...prev,
                        emptyEvidence(defaultDeliverableType || "document"),
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add evidence
                  </Button>
                </div>

                {evidence.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 px-3 py-3 text-xs text-slate-500">
                    {hasExistingDeliverable
                      ? "Optional — add more evidence (file, link or text) if you have it."
                      : "Attach at least one deliverable — a file, a link, or a written result."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {evidence.map((e) => (
                      <div
                        key={e._key}
                        className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5"
                      >
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_auto]">
                          <Select
                            value={e.type}
                            onValueChange={(v) => updateEvidence(e._key, { type: v ?? "document" })}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {DELIVERABLE_TYPES.find((t) => t.value === e.type)?.label ?? e.type}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {DELIVERABLE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={e.title}
                            onChange={(ev) => updateEvidence(e._key, { title: ev.target.value })}
                            placeholder="Title — what is this deliverable?"
                            maxLength={500}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setEvidence((prev) => prev.filter((x) => x._key !== e._key))
                            }
                            aria-label="Remove evidence"
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 w-fit">
                          {(["link", "file", "text"] as EvidenceMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => updateEvidence(e._key, { mode: m })}
                              className={cn(
                                "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                                e.mode === m
                                  ? "bg-white text-blue-600 shadow-sm"
                                  : "text-slate-500 hover:text-slate-700",
                              )}
                            >
                              {m}
                            </button>
                          ))}
                        </div>

                        {e.mode === "text" ? (
                          <Textarea
                            value={e.text_content}
                            onChange={(ev) =>
                              updateEvidence(e._key, { text_content: ev.target.value })
                            }
                            placeholder="Paste the result — summary, findings, sign-off note…"
                            rows={3}
                          />
                        ) : e.mode === "file" ? (
                          <div className="space-y-1.5">
                            <input
                              ref={(el) => {
                                fileInputsRef.current[e._key] = el;
                              }}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.svg,.webp,.zip"
                              onChange={(ev) => {
                                const file = ev.target.files?.[0] ?? null;
                                ev.target.value = "";
                                if (file) handleFilePicked(e._key, file);
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              disabled={e._uploading}
                              onClick={() => fileInputsRef.current[e._key]?.click()}
                            >
                              {e._uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileUp className="h-3.5 w-3.5" />
                              )}
                              {e._uploading
                                ? "Uploading…"
                                : e._fileName
                                  ? "Replace file"
                                  : "Upload file"}
                            </Button>
                            {e.url && !e._uploading && (
                              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate flex-1 font-medium">
                                  {e._fileName ?? e.url}
                                </span>
                              </div>
                            )}
                            {e._uploadError && (
                              <p className="text-[11px] text-rose-600">{e._uploadError}</p>
                            )}
                            <p className="text-[10px] text-slate-500">
                              Max 8 MB · PDF, Office, images, archives.
                            </p>
                          </div>
                        ) : (
                          <Input
                            type="url"
                            value={e.url}
                            onChange={(ev) =>
                              updateEvidence(e._key, { url: ev.target.value, _fileName: undefined })
                            }
                            placeholder="Paste a link — doc, PR, Figma, dashboard… (https://…)"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="!px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="btn-gradient">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Mark completed
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
