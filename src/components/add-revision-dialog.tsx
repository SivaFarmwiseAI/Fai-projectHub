"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

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
  phases as phasesApi,
  tasks as tasksApi,
  uploads as uploadsApi,
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

type AttachmentDraft = RevisionAttachmentInput & {
  _key: string;
  _uploading?: boolean;
  _fileName?: string;
  _uploadError?: string;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

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
    patch: Partial<AttachmentDraft>,
  ) =>
    setAttachments((prev) =>
      prev.map((a) => (a._key === key ? { ...a, ...patch } : a)),
    );

  const handleFilePicked = async (key: string, file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      updateAttachment(key, {
        _uploadError: "File too large — max 8 MB",
        _uploading: false,
        _fileName: file.name,
      });
      showToast.error("File too large", "Maximum upload size is 8 MB");
      return;
    }
    updateAttachment(key, {
      _uploading: true,
      _fileName: file.name,
      _uploadError: undefined,
    });
    try {
      const url = await uploadsApi.uploadFileSmart(file);
      // Auto-fill title if empty so the chip on the timeline reads cleanly.
      setAttachments((prev) =>
        prev.map((a) =>
          a._key === key
            ? {
                ...a,
                url,
                title: a.title.trim() ? a.title : file.name,
                _uploading: false,
                _fileName: file.name,
                _uploadError: undefined,
              }
            : a,
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
      updateAttachment(key, { _uploading: false, _uploadError: msg });
      showToast.error("Upload failed", msg);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) {
      showToast.warning("Add a short summary so the timeline reads cleanly.");
      return;
    }
    if (attachments.some((a) => a._uploading)) {
      showToast.warning("An upload is still in progress — please wait.");
      return;
    }
    const cleanedAttachments: RevisionAttachmentInput[] = attachments
      .filter((a) => a.title.trim() && (a.url?.trim() || a.content?.trim()))
      .map((a) => ({
        title: a.title.trim(),
        type: a.type,
        url: a.url?.trim() || undefined,
        content: a.content?.trim() || undefined,
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
                Add attachment
              </Button>
            </div>
            {attachments.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 px-3 py-3 text-xs text-slate-500">
                Optional — upload a file or paste a URL (repo, Figma, design
                doc, etc.). You can also paste raw code.
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((a) => {
                  const isCode = a.type === "code";
                  return (
                    <div
                      key={a._key}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5"
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

                      {isCode ? (
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
                        <div className="space-y-1.5">
                          <input
                            ref={(el) => {
                              fileInputsRef.current[a._key] = el;
                            }}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.svg,.webp,.zip"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              e.target.value = "";
                              if (file) handleFilePicked(a._key, file);
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              disabled={a._uploading}
                              onClick={() =>
                                fileInputsRef.current[a._key]?.click()
                              }
                            >
                              {a._uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileUp className="h-3.5 w-3.5" />
                              )}
                              {a._uploading
                                ? "Uploading…"
                                : a._fileName
                                  ? "Replace file"
                                  : "Upload File"}
                            </Button>
                            <span className="text-[11px] text-slate-400">or</span>
                            <Input
                              type="url"
                              value={a.url ?? ""}
                              onChange={(e) =>
                                updateAttachment(a._key, {
                                  url: e.target.value,
                                  // Clear file label when the user manually
                                  // edits the URL so the chip below stays honest.
                                  _fileName: undefined,
                                })
                              }
                              placeholder="Paste a link (https://…)"
                              className="h-8 flex-1 text-xs"
                            />
                          </div>
                          {a.url && !a._uploading && (
                            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1 text-[11px] text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate flex-1 font-medium">
                                {a._fileName ?? a.url}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateAttachment(a._key, {
                                    url: "",
                                    _fileName: undefined,
                                    _uploadError: undefined,
                                  })
                                }
                                className="text-rose-500 hover:text-rose-700"
                                aria-label="Clear"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          {a._uploadError && (
                            <p className="text-[11px] text-rose-600">{a._uploadError}</p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Max 8 MB · PDF, Office, images, archives.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
