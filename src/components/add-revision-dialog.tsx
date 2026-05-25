"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

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
  phases as phasesApi,
  tasks as tasksApi,
  type CreateRevisionPayload,
  type PhaseRevision,
  type RevisionAttachmentInput,
  type RevisionAttachmentType,
  type RevisionChangeType,
  type TaskRevision,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

type Entity = "phase" | "task";

type Props = {
  entity: Entity;
  entityId: string;
  entityLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (rev: PhaseRevision | TaskRevision) => void;
};

type AttachmentDraft = RevisionAttachmentInput & { _key: string };

const CHANGE_TYPES: { value: RevisionChangeType; label: string }[] = [
  { value: "revision",         label: "Revision (requirement change)" },
  { value: "description_edit", label: "Description edit" },
  { value: "status_change",    label: "Status change" },
  { value: "note",             label: "Note / comment" },
  { value: "closure",          label: "Closure (mark complete)" },
];

const ATTACH_TYPES: { value: RevisionAttachmentType; label: string }[] = [
  { value: "url",      label: "URL" },
  { value: "repo",     label: "Code repo" },
  { value: "figma",    label: "Figma" },
  { value: "design",   label: "Design doc" },
  { value: "document", label: "Document" },
  { value: "code",     label: "Code snippet" },
];

const emptyAttachment = (): AttachmentDraft => ({
  _key: Math.random().toString(36).slice(2),
  title: "",
  type: "url",
  url: "",
});

export function AddRevisionDialog({
  entity,
  entityId,
  entityLabel,
  open,
  onOpenChange,
  onAdded,
}: Props) {
  const [changeType, setChangeType] = useState<RevisionChangeType>("revision");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChangeType("revision");
    setSummary("");
    setDetails("");
    setPreviousValue("");
    setNewValue("");
    setAttachments([]);
  }, [open]);

  const addAttachmentRow = () =>
    setAttachments((prev) => [...prev, emptyAttachment()]);

  const removeAttachmentRow = (key: string) =>
    setAttachments((prev) => prev.filter((a) => a._key !== key));

  const updateAttachment = (
    key: string,
    patch: Partial<RevisionAttachmentInput>,
  ) =>
    setAttachments((prev) =>
      prev.map((a) => (a._key === key ? { ...a, ...patch } : a)),
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) {
      showToast.warning("Add a short summary so the timeline reads cleanly.");
      return;
    }
    const cleanedAttachments: RevisionAttachmentInput[] = attachments
      .filter((a) => a.title.trim() && (a.url?.trim() || a.content?.trim()))
      .map(({ _key, ...rest }) => ({
        title: rest.title.trim(),
        type: rest.type,
        url: rest.url?.trim() || undefined,
        content: rest.content?.trim() || undefined,
      }));

    const payload: CreateRevisionPayload = {
      summary: summary.trim(),
      change_type: changeType,
      details: details.trim() || undefined,
      previous_value: previousValue.trim() || undefined,
      new_value: newValue.trim() || undefined,
      attachments: cleanedAttachments.length ? cleanedAttachments : undefined,
    };

    setSaving(true);
    try {
      const res =
        entity === "phase"
          ? await phasesApi.addRevision(entityId, payload)
          : await tasksApi.addRevision(entityId, payload);
      onAdded(res.revision);
      showToast.success("Revision recorded");
      onOpenChange(false);
    } catch (err) {
      showToast.error(
        "Could not save revision",
        err instanceof Error ? err.message : "Please try again",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Log a revision
            {entityLabel ? ` · ${entityLabel}` : ""}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="change_type">Type</Label>
              <Select
                value={changeType}
                onValueChange={(v) => setChangeType(v as RevisionChangeType)}
              >
                <SelectTrigger id="change_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="summary">Summary *</Label>
              <Input
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. CEO requested mobile-first onboarding"
                maxLength={500}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Optional — what changed and why"
              rows={3}
            />
          </div>

          {(changeType === "revision" ||
            changeType === "description_edit" ||
            changeType === "status_change") && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="previous_value">Before</Label>
                <Textarea
                  id="previous_value"
                  value={previousValue}
                  onChange={(e) => setPreviousValue(e.target.value)}
                  placeholder="Previous requirement / state"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_value">After</Label>
                <Textarea
                  id="new_value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Updated requirement / state"
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addAttachmentRow}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add link
              </Button>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500">
                Optional — paste a URL, repo link, Figma file, design doc, or paste code.
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((a) => (
                  <div
                    key={a._key}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
                      <Select
                        value={a.type as string}
                        onValueChange={(v) =>
                          updateAttachment(a._key, {
                            type: v as RevisionAttachmentType,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTACH_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={a.title}
                        onChange={(e) =>
                          updateAttachment(a._key, { title: e.target.value })
                        }
                        placeholder="Title (shown on the timeline)"
                        maxLength={500}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAttachmentRow(a._key)}
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                    {a.type === "code" ? (
                      <Textarea
                        value={a.content ?? ""}
                        onChange={(e) =>
                          updateAttachment(a._key, { content: e.target.value })
                        }
                        placeholder="Paste code snippet"
                        rows={4}
                        className="font-mono text-xs"
                      />
                    ) : (
                      <Input
                        type="url"
                        value={a.url ?? ""}
                        onChange={(e) =>
                          updateAttachment(a._key, { url: e.target.value })
                        }
                        placeholder="https://…"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="!px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save revision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
