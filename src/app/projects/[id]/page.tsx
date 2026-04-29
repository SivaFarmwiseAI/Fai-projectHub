"use client";

import React, { useState, use, useEffect } from "react";
import {
  projects as projectsApi,
  tasks as tasksApi,
  phases as phasesApi,
  users as usersApi,
  submissions as submissionsApi,
  type Project,
  type Task,
  type TaskMilestone,
  type DeadlineExtension,
  type Phase,
  type User,
  type ProjectUpdate,
  type Submission,
  type Checkpoint,
  type Deliverable,
  type ProjectDocument,
  type AiPlan,
} from "@/lib/api-client";

// Module-level user cache for sub-component lookups
let _userMap: Record<string, User> = {};

type DeliverableType = string;
type OutcomeType = string;

// Stub functions for features without API equivalents
function getUser(id: string) { return _userMap[id]; }
function computeImpactAreas(_pid: string, _section: string, _sid: string) { return []; }
function addEditChange(_pid: string, _data: unknown) {}
function generateAIPhases(_type: string, _title: string) { return [] as { name: string; description: string; estimatedDuration: string; checklist: { item: string; done: boolean }[] }[]; }
function addTask(_pid: string, _data: unknown) {}
function addPhase(_pid: string, _data: unknown) {}
function updatePhase(_pid: string, _phaseId: string, _data: unknown) {}
function removePhase(_pid: string, _phaseId: string) {}
function removeDocument(_pid: string, _docId: string) {}
function addDocument(_pid: string, _data: unknown) {}
function updateTaskReviewStatus(_pid: string, _taskId: string, _status: string, _userId: string, _feedback?: string) {}
function addReviewTask(_data: unknown) {}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

import {
  ArrowLeft, Clock, Users, CheckCircle2, Circle, Timer, FileText, Code2,
  Kanban,
  Sparkles, AlertTriangle, Target, Brain, Activity, ExternalLink, ChevronRight,
  ChevronDown, ChevronUp, GitBranch, Pencil, PackageCheck, GitPullRequest,
  Database, Upload, Link as LinkIcon, Presentation, MessageSquare, FileUp,
  UserCheck, Hourglass, CalendarClock, ShieldCheck, ShieldX, XCircle,
  Trophy, RotateCcw, Plus, Layers, Eye, Send, Paperclip, UserPlus,
  Settings, SwitchCamera, X, ClipboardList, Package, FileCheck, ArrowRight,
  Star, BarChart3, BookOpen, GitCommit, MessageCircle, Shield, Zap, Hash,
  List, Flag, AlertOctagon, Lightbulb, ScrollText,
} from "lucide-react";

// ─── View Role Context ────────────────────────────────────
type ViewRole = "ceo" | "team_member";

import { format, differenceInDays, addDays } from "date-fns";

// ─── Helpers ───────────────────────────────────────────────

function Avatar({ userId, size = "sm" }: { userId: string; size?: "sm" | "md" | "lg" }) {
  const user = _userMap[userId];
  if (!user) return null;
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : size === "md" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ backgroundColor: user.avatar_color }}>
      {user.name[0]}
    </div>
  );
}

function formatShortDate(dateStr: string) {
  try { return format(new Date(dateStr), "MMM d, yyyy"); } catch { return dateStr; }
}

function stepStatusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (status === "in_progress") return <Activity className="h-3.5 w-3.5 text-blue-500 shrink-0 animate-pulse" />;
  if (status === "blocked") return <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  if (status === "skipped") return <XCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  return <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />;
}

const statusColors: Record<string, string> = {
  planning: "text-slate-600 bg-slate-50 border-slate-200",
  in_progress: "text-blue-700 bg-blue-50 border-blue-200",
  completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  blocked: "text-red-700 bg-red-50 border-red-200",
  killed: "text-gray-600 bg-gray-100 border-gray-300",
  redefined: "text-purple-700 bg-purple-50 border-purple-200",
  pending: "text-slate-600 bg-slate-50 border-slate-200",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-400", medium: "bg-amber-400", high: "bg-red-500",
};

const deliverableTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  code: { icon: <Code2 className="h-3 w-3" />, label: "Code", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  document: { icon: <FileText className="h-3 w-3" />, label: "Document", color: "text-blue-700 bg-blue-50 border-blue-200" },
  ppt: { icon: <Presentation className="h-3 w-3" />, label: "Presentation", color: "text-orange-700 bg-orange-50 border-orange-200" },
  text: { icon: <MessageSquare className="h-3 w-3" />, label: "Text", color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  meeting_notes: { icon: <Users className="h-3 w-3" />, label: "Meeting Notes", color: "text-teal-700 bg-teal-50 border-teal-200" },
  data: { icon: <Database className="h-3 w-3" />, label: "Data", color: "text-purple-700 bg-purple-50 border-purple-200" },
};

// ─── Attachment / Upload Bar (reusable) ───────────────────

function AttachmentBar({ label, compact }: { label?: string; compact?: boolean }) {
  const [showUpload, setShowUpload] = useState(false);
  return (
    <div>
      {!showUpload ? (
        <button
          onClick={() => setShowUpload(true)}
          className={`flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors ${compact ? "text-[10px]" : "text-[11px]"}`}
        >
          <Paperclip className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {label || "Attach file or link"}
        </button>
      ) : (
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-blue-700 uppercase tracking-wider">Attach</span>
            <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-gray-700">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 flex-1">
              <Upload className="h-3 w-3" /> Upload File
            </Button>
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1 flex-1">
              <LinkIcon className="h-3 w-3" /> Paste Link
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-blue-100">PDF</Badge>
            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-blue-100">DOCX</Badge>
            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-blue-100">PPTX</Badge>
            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-blue-100">Image</Badge>
            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-blue-100">Google Doc</Badge>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit with Impact Analysis (reusable) ──────────────────

function EditWithImpact({
  label, projectId, section, sectionId, sectionTitle, currentValue, onSave, viewRole, fieldType = "textarea"
}: {
  label: string; projectId: string; section: string;
  sectionId: string; sectionTitle: string; currentValue: string; onSave: (val: string) => void; viewRole: "ceo" | "team_member"; fieldType?: "text" | "textarea" | "date"
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue);
  const [showImpact, setShowImpact] = useState(false);
  const [impacts, setImpacts] = useState<{ area: string; description: string; severity: "low" | "medium" | "high" }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const severityColors: Record<string, string> = { low: "text-yellow-700 bg-yellow-50 border-yellow-200", medium: "text-orange-700 bg-orange-50 border-orange-200", high: "text-red-700 bg-red-50 border-red-200" };
  const severityIcons: Record<string, string> = { low: "●", medium: "▲", high: "◆" };

  const handleEdit = () => { setEditing(true); setValue(currentValue); };

  const handleShowImpact = () => {
    const computed = computeImpactAreas(projectId, section, sectionId);
    setImpacts(computed);
    setShowImpact(true);
  };

  const handleSubmitForApproval = () => {
    addEditChange(projectId, {
      section, sectionId, sectionTitle,
      changeDescription: `Updated ${label}`,
      changedBy: viewRole === "ceo" ? "u1" : "u2",
      impactAreas: impacts,
    });
    if (viewRole === "ceo") { onSave(value); }
    setSubmitted(true);
    setTimeout(() => { setEditing(false); setShowImpact(false); setSubmitted(false); }, 2000);
  };

  if (!editing) {
    return (
      <button onClick={handleEdit} className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors opacity-60 hover:opacity-100">
        <Pencil className="h-2.5 w-2.5" /> Edit
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Edit {label}
        </span>
        <button onClick={() => { setEditing(false); setShowImpact(false); }} className="text-gray-400 hover:text-gray-600">
          <X className="h-3 w-3" />
        </button>
      </div>
      {fieldType === "textarea" ? (
        <Textarea value={value} onChange={e => setValue(e.target.value)} className="text-xs" rows={3} />
      ) : fieldType === "date" ? (
        <Input type="date" value={value} onChange={e => setValue(e.target.value)} className="text-xs h-8" />
      ) : (
        <Input value={value} onChange={e => setValue(e.target.value)} className="text-xs h-8" />
      )}
      {!showImpact ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleShowImpact} disabled={value === currentValue} className="text-[10px] h-7 gap-1">
            <AlertTriangle className="h-3 w-3" /> Check Impact & Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); }} className="text-[10px] h-7">Cancel</Button>
        </div>
      ) : submitted ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-[11px] text-emerald-700 font-medium">
            {viewRole === "ceo" ? "Change applied successfully" : "Submitted for approval"}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
            <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Impact Analysis
            </p>
            <div className="space-y-1.5">
              {impacts.map((impact, idx) => (
                <div key={idx} className={`flex items-start gap-2 px-2 py-1.5 rounded border text-[10px] ${severityColors[impact.severity]}`}>
                  <span className="shrink-0 mt-0.5">{severityIcons[impact.severity]}</span>
                  <div>
                    <span className="font-semibold">{impact.area}</span>
                    <span className="text-gray-600 ml-1">— {impact.description}</span>
                  </div>
                  <Badge variant="outline" className={`text-[8px] ml-auto shrink-0 ${severityColors[impact.severity]}`}>{impact.severity}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmitForApproval} className="text-[10px] h-7 gap-1 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> {viewRole === "ceo" ? "Approve & Apply" : "Submit for Approval"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowImpact(false); }} className="text-[10px] h-7">Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assignee Editor (multi-user) ─────────────────────────

function AssigneeEditor({ assigneeIds, onClose }: { assigneeIds: string[]; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(assigneeIds);
  const teamMembers = Object.values(_userMap);

  const toggleUser = (uid: string) => {
    setSelected(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assign Members</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="space-y-1">
        {teamMembers.map(user => (
          <div
            key={user.id}
            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
              selected.includes(user.id) ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
            }`}
            onClick={() => toggleUser(user.id)}
          >
            <Checkbox checked={selected.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} />
            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: user.avatar_color || "#64748b" }}>
              {user.name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium">{user.name}</p>
              <p className="text-[9px] text-muted-foreground">{user.role}</p>
            </div>
          </div>
        ))}
      </div>
      <Button size="sm" className="w-full text-[11px] h-7">Save Assignment</Button>
    </div>
  );
}

// ─── Review Task Assignment Panel ─────────────────────────

function ReviewTaskPanel({ onClose, sourceType, sourceTitle, projectId, projectTitle }: {
  onClose: () => void;
  sourceType: "deliverable" | "milestone" | "task";
  sourceTitle: string;
  projectId: string;
  projectTitle: string;
}) {
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assigned, setAssigned] = useState(false);
  const [assignedNames, setAssignedNames] = useState<string[]>([]);
  const teamMembers = Object.values(_userMap);

  const toggleUser = (uid: string) => {
    setSelectedAssignees(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleAssign = () => {
    if (!taskDesc.trim() || selectedAssignees.length === 0) return;
    addReviewTask({
      description: taskDesc,
      assigneeIds: selectedAssignees,
      assignedBy: "u1",
      priority,
      dueDate: dueDate || undefined,
      sourceType,
      sourceTitle,
      projectId,
      projectTitle,
    });
    setAssignedNames(selectedAssignees.map(id => getUser(id)?.name || ""));
    setAssigned(true);
  };

  if (assigned) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-[11px] font-semibold text-emerald-700">Task Assigned Successfully</span>
        </div>
        <p className="text-[10px] text-emerald-600">
          &quot;{taskDesc}&quot; assigned to {assignedNames.join(", ")}
        </p>
        <p className="text-[9px] text-emerald-500">This will appear in their Daily Work Planner on the dashboard.</p>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 text-emerald-600" onClick={onClose}>Dismiss</Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-300 bg-violet-50/40 p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider flex items-center gap-1">
          <ClipboardList className="h-3 w-3" /> Assign Review Task
        </span>
        <button onClick={onClose} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
      </div>

      <div className="rounded bg-violet-100/50 border border-violet-200 px-2 py-1.5">
        <p className="text-[9px] text-violet-500 uppercase tracking-wider font-medium">Re: {sourceType}</p>
        <p className="text-[10px] text-violet-700 font-medium truncate">{sourceTitle}</p>
      </div>

      <div>
        <label className="text-[10px] text-violet-600 font-medium">Task</label>
        <Input
          placeholder="e.g. Review this PR and provide feedback on error handling"
          className="text-[11px] h-8 mt-0.5 border-violet-200 focus-visible:ring-violet-400"
          value={taskDesc}
          onChange={e => setTaskDesc(e.target.value)}
        />
      </div>

      <div>
        <label className="text-[10px] text-violet-600 font-medium">Assign to</label>
        <div className="space-y-1 mt-1">
          {teamMembers.map(user => (
            <div
              key={user.id}
              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                selectedAssignees.includes(user.id) ? "bg-violet-100 border border-violet-300" : "hover:bg-violet-50 border border-transparent"
              }`}
              onClick={() => toggleUser(user.id)}
            >
              <Checkbox checked={selectedAssignees.includes(user.id)} onCheckedChange={() => toggleUser(user.id)} />
              <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: user.avatar_color || "#64748b" }}>
                {user.name[0]}
              </div>
              <span className="text-[11px] font-medium">{user.name}</span>
              <span className="text-[9px] text-muted-foreground">({user.role})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-violet-600 font-medium">Due</label>
          <Input
            placeholder="e.g. Apr 5, 2026"
            className="text-[11px] h-7 mt-0.5 border-violet-200 focus-visible:ring-violet-400"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] text-violet-600 font-medium">Priority</label>
          <div className="flex gap-1 mt-0.5">
            {(["low", "medium", "high"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  priority === p
                    ? p === "low" ? "bg-slate-600 text-white" : p === "medium" ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {p[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        size="sm"
        className={`w-full text-[10px] h-7 gap-1 ${
          taskDesc.trim() && selectedAssignees.length > 0
            ? "bg-violet-600 hover:bg-violet-700"
            : "bg-gray-300 cursor-not-allowed"
        }`}
        disabled={!taskDesc.trim() || selectedAssignees.length === 0}
        onClick={handleAssign}
      >
        <ClipboardList className="h-3 w-3" /> Assign Task{selectedAssignees.length > 0 ? ` to ${selectedAssignees.length} person${selectedAssignees.length > 1 ? "s" : ""}` : ""}
      </Button>
    </div>
  );
}

// ─── Deliverable Renderer ──────────────────────────────────

function DeliverableCard({ d, viewRole, projectId, projectTitle }: { d: Deliverable; viewRole: ViewRole; projectId: string; projectTitle: string }) {
  const config = deliverableTypeConfig[d.type];
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showReviewTask, setShowReviewTask] = useState(false);

  return (
    <div className="p-2.5 rounded-lg border border-border bg-white space-y-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-[10px] gap-1 ${config.color}`}>
          {config.icon} {config.label}
        </Badge>
        <span className="text-xs font-medium flex-1 truncate">{d.title}</span>
        <Badge variant="outline" className={`text-[9px] ${
          d.status === "verified" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
          d.status === "submitted" ? "text-amber-700 bg-amber-50 border-amber-200" :
          d.status === "rejected" ? "text-red-700 bg-red-50 border-red-200" :
          "text-gray-500 bg-gray-50 border-gray-200"
        }`}>
          {d.status}
        </Badge>
      </div>

      {/* Code deliverable */}
      {d.type === "code" && (d.code_pr_url || d.code_repo_url) && (
        <div className="flex items-center gap-2 text-[11px]">
          {d.code_pr_url && (
            <a href={d.code_pr_url} className="flex items-center gap-1 text-blue-600 hover:underline">
              <GitPullRequest className="h-3 w-3" /> View PR
            </a>
          )}
          {d.code_repo_url && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {d.code_repo_url}
            </span>
          )}
        </div>
      )}

      {/* Text / description content */}
      {d.description && (
        <p className="text-[11px] text-muted-foreground bg-gray-50 rounded p-2">{d.description}</p>
      )}

      {/* Document / PPT */}
      {(d.type === "document" || d.type === "ppt" || d.type === "data") && d.document_url && (
        <a href={d.document_url} className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
          <ExternalLink className="h-3 w-3" /> View {d.type === "ppt" ? "Presentation" : "Document"}
        </a>
      )}

      {/* Verification feedback */}
      {d.feedback && d.verified_by && (
        <div className="rounded p-2 bg-emerald-50 border border-emerald-200 flex items-start gap-2">
          <Avatar userId={d.verified_by} size="sm" />
          <div>
            <span className="text-[10px] font-medium text-emerald-700">
              Verified by {getUser(d.verified_by)?.name}
            </span>
            <p className="text-[10px] text-emerald-600">{d.feedback}</p>
          </div>
        </div>
      )}

      {/* ── CEO: Review / Give Feedback ── */}
      {viewRole === "ceo" && d.status === "submitted" && !d.feedback && (
        <div className="space-y-2 pt-1 border-t border-dashed border-blue-200">
          {!showFeedbackInput ? (
            <div className="flex gap-2">
              <Button size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => {}}>
                <CheckCircle2 className="h-3 w-3" /> Verify
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setShowFeedbackInput(true)}>
                <MessageSquare className="h-3 w-3" /> Feedback
              </Button>
              <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => {}}>
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">CEO Feedback</span>
                <button onClick={() => setShowFeedbackInput(false)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
              </div>
              <Textarea
                placeholder="Write your feedback on this deliverable..."
                className="text-[11px] min-h-[60px] resize-none"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
              />
              <AttachmentBar label="Attach reference document" compact />
              <div className="flex gap-2">
                <Button size="sm" className="text-[10px] h-6 gap-1 bg-blue-600 hover:bg-blue-700">
                  <Send className="h-3 w-3" /> Send Feedback
                </Button>
                <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                  <CheckCircle2 className="h-3 w-3" /> Verify with Feedback
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CEO: Assign Review Task (any status) ── */}
      {viewRole === "ceo" && (
        <div className="pt-1">
          {!showReviewTask ? (
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-6 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
              onClick={() => setShowReviewTask(true)}
            >
              <ClipboardList className="h-3 w-3" /> Assign Task
            </Button>
          ) : (
            <ReviewTaskPanel onClose={() => setShowReviewTask(false)} sourceType="deliverable" sourceTitle={d.title} projectId={projectId} projectTitle={projectTitle} />
          )}
        </div>
      )}

      {/* ── Team Member: Upload / Resubmit ── */}
      {viewRole === "team_member" && (d.status === "pending" || d.status === "rejected") && (
        <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200">
          <Button size="sm" className="text-[10px] h-6 gap-1 bg-blue-600 hover:bg-blue-700">
            <Upload className="h-3 w-3" /> {d.status === "rejected" ? "Resubmit" : "Submit"} Deliverable
          </Button>
          <AttachmentBar label="Attach files" compact />
        </div>
      )}
    </div>
  );
}

// ─── Milestone Card (nested inside Task) ────────────────────

function MilestoneSection({ milestone, taskAssignee, viewRole, projectId, projectTitle }: { milestone: TaskMilestone; taskAssignee: string; viewRole: ViewRole; projectId: string; projectTitle: string }) {
  const [expanded, setExpanded] = useState(milestone.status === "in_progress");
  const [showAssigneeEditor, setShowAssigneeEditor] = useState(false);
  const [showMilestoneReviewTask, setShowMilestoneReviewTask] = useState(false);
  const config = deliverableTypeConfig[milestone.deliverable_type ?? "text"] || deliverableTypeConfig.text;
  const assignee = milestone.assignee_id ? getUser(milestone.assignee_id) : getUser(taskAssignee);
  const completedDeliverables = (milestone.deliverables ?? []).filter(d => d.status === "verified").length;
  const totalDeliverables = (milestone.deliverables ?? []).length;

  return (
    <div className={`rounded-lg border ${
      milestone.status === "completed" ? "border-emerald-200 bg-emerald-50/30" :
      milestone.status === "in_progress" ? "border-blue-200 bg-blue-50/30" :
      milestone.status === "blocked" ? "border-red-200 bg-red-50/30" :
      "border-border bg-gray-50/50"
    }`}>
      {/* Milestone Header */}
      <div
        className="flex items-center gap-2.5 p-3 cursor-pointer hover:bg-white/50 transition-colors rounded-lg"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status icon */}
        {milestone.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
         milestone.status === "in_progress" ? <Activity className="h-4 w-4 text-blue-500 shrink-0 animate-pulse" /> :
         milestone.status === "blocked" ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /> :
         <Circle className="h-4 w-4 text-gray-300 shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{milestone.title}</span>
            <Badge variant="outline" className={`text-[9px] gap-0.5 ${config.color}`}>
              {config.icon} {config.label}
            </Badge>
          </div>
          {milestone.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{milestone.description}</p>
          )}
        </div>

        {/* Right side: assignee, deliverable count, target */}
        <div className="flex items-center gap-2 shrink-0">
          {totalDeliverables > 0 && (
            <span className="text-[10px] text-muted-foreground">{completedDeliverables}/{totalDeliverables}</span>
          )}
          {assignee && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowAssigneeEditor(!showAssigneeEditor); }}
                className="hover:ring-2 hover:ring-blue-300 rounded-full transition-all"
                title="Click to reassign"
              >
                <Avatar userId={assignee.id} size="sm" />
              </button>
              {showAssigneeEditor && (
                <div className="absolute top-8 right-0 z-20" onClick={e => e.stopPropagation()}>
                  <AssigneeEditor assigneeIds={[milestone.assignee_id || taskAssignee]} onClose={() => setShowAssigneeEditor(false)} />
                </div>
              )}
            </div>
          )}
          {milestone.target_day && (
            <span className="text-[10px] text-muted-foreground">Day {milestone.target_day}</span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border/50 pt-2.5">
          {/* Success Criteria */}
          {(milestone.success_criteria ?? []).length > 0 && (
            <div>
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1">Success Criteria</h6>
              <div className="space-y-0.5">
                {(milestone.success_criteria ?? []).map((sc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{sc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {(milestone.deliverables ?? []).length > 0 && (
            <div>
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Deliverables</h6>
              <div className="space-y-1.5">
                {(milestone.deliverables ?? []).map(d => <DeliverableCard key={d.id} d={d} viewRole={viewRole} projectId={projectId} projectTitle={projectTitle} />)}
              </div>
            </div>
          )}

          {/* Outcome */}
          {milestone.outcome && (
            <div className="rounded p-2 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700">
              <span className="font-medium">Outcome: {milestone.outcome}</span>
              {milestone.outcome_notes && <p className="mt-0.5 opacity-80">{milestone.outcome_notes}</p>}
            </div>
          )}

          {/* Attachment / Upload area */}
          {milestone.status !== "completed" && (
            <div className="space-y-2">
              {viewRole === "team_member" && (
                <div className="flex items-center gap-2">
                  <Button size="sm" className="text-[10px] h-7 gap-1 bg-blue-600 hover:bg-blue-700">
                    <Upload className="h-3 w-3" /> Submit Deliverable
                  </Button>
                  <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1">
                    <FileUp className="h-3 w-3" /> Upload Document
                  </Button>
                </div>
              )}
              {viewRole === "ceo" && (milestone.deliverables ?? []).length === 0 && (
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1">
                  <Upload className="h-3 w-3" /> Submit Deliverable
                </Button>
              )}
              <AttachmentBar label="Attach file to milestone" compact />
            </div>
          )}

          {/* ── CEO: Assign Review for Milestone ── */}
          {viewRole === "ceo" && (
            <div>
              {!showMilestoneReviewTask ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-6 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                  onClick={() => setShowMilestoneReviewTask(true)}
                >
                  <ClipboardList className="h-3 w-3" /> Assign Review
                </Button>
              ) : (
                <ReviewTaskPanel onClose={() => setShowMilestoneReviewTask(false)} sourceType="milestone" sourceTitle={milestone.title} projectId={projectId} projectTitle={projectTitle} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task Card (the primary unit) ───────────────────────────

function TaskCard({ task, projectId, projectTitle, viewRole, onReviewUpdate }: { task: Task; projectId: string; projectTitle: string; viewRole: ViewRole; onReviewUpdate?: () => void }) {
  const [expanded, setExpanded] = useState(task.status === "in_progress" || task.status === "planning");
  const [showSteps, setShowSteps] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [showAssigneeEditor, setShowAssigneeEditor] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [updateText, setUpdateText] = useState("");

  const assignee = getUser(task.assignee_id ?? "");
  const completedSteps = (task.steps ?? []).filter(s => s.status === "completed").length;
  const completedMilestones = (task.milestones ?? []).filter(m => m.status === "completed").length;
  const pendingExtensions = (task.deadline_extensions ?? []).filter(de => de.status === "pending").length;
  const hoursCompleted = (task.steps ?? []).filter(s => s.status === "completed").reduce((sum, s) => sum + (s.estimated_hours ?? 0), 0);

  return (
    <Card className={`overflow-hidden transition-all ${
      task.status === "completed" ? "border-emerald-200" :
      task.status === "blocked" ? "border-red-200" :
      task.status === "in_progress" ? "border-blue-200" :
      "border-border"
    }`}>
      {/* Task Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Priority dot */}
        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityColors[task.priority]}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{task.title}</h3>
            <Badge variant="outline" className={`text-[10px] ${statusColors[task.status]}`}>
              {task.status.replace("_", " ")}
            </Badge>
            {task.plan_status && (
              <Badge variant="outline" className={`text-[9px] ${
                task.plan_status === "finalized" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                task.plan_status === "being_refined" ? "text-amber-600 bg-amber-50 border-amber-200" :
                "text-purple-600 bg-purple-50 border-purple-200"
              }`}>
                {task.plan_status === "finalized" ? "Plan Finalized" :
                 task.plan_status === "being_refined" ? "Plan Being Refined" :
                 "AI Plan"}
              </Badge>
            )}
            {pendingExtensions > 0 && (
              <Badge className="text-[9px] bg-red-500 text-white border-0 animate-pulse">
                {pendingExtensions} extension{pendingExtensions > 1 ? "s" : ""} pending
              </Badge>
            )}
            {task.review_status && (
              <Badge variant="outline" className={`text-[9px] ${
                task.review_status === "approved" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                task.review_status === "changes_requested" ? "text-amber-600 bg-amber-50 border-amber-200" :
                task.review_status === "rejected" ? "text-red-600 bg-red-50 border-red-200" :
                "text-blue-600 bg-blue-50 border-blue-200"
              }`}>
                {task.review_status === "approved" ? "Approved" :
                 task.review_status === "changes_requested" ? "Changes Requested" :
                 task.review_status === "rejected" ? "Rejected" :
                 "Pending Review"}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        </div>

        {/* Right side stats */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Milestones progress */}
          <div className="text-center">
            <p className="text-xs font-bold">{completedMilestones}/{(task.milestones ?? []).length}</p>
            <p className="text-[9px] text-muted-foreground">milestones</p>
          </div>
          {/* Hours */}
          <div className="text-center">
            <p className="text-xs font-bold">{hoursCompleted}/{task.estimated_hours}h</p>
            <p className="text-[9px] text-muted-foreground">hours</p>
          </div>
          {/* Assignee (clickable to edit) */}
          {assignee && (
            <div className="relative">
              <button
                className="flex items-center gap-1.5 hover:ring-2 hover:ring-blue-300 rounded-full transition-all pr-1"
                onClick={(e) => { e.stopPropagation(); setShowAssigneeEditor(!showAssigneeEditor); }}
                title="Click to modify assignment"
              >
                <Avatar userId={task.assignee_id ?? ""} size="sm" />
                <span className="text-xs text-muted-foreground hidden lg:inline">{assignee?.name}</span>
                <UserPlus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {showAssigneeEditor && (
                <div className="absolute top-9 right-0 z-20" onClick={e => e.stopPropagation()}>
                  <AssigneeEditor assigneeIds={task.assignee_id ? [task.assignee_id] : []} onClose={() => setShowAssigneeEditor(false)} />
                </div>
              )}
            </div>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Progress bar */}
      {(task.steps ?? []).length > 0 && (
        <div className="px-4 pb-1">
          <Progress value={(completedSteps / (task.steps ?? []).length) * 100} className="h-1" />
        </div>
      )}

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">

          {/* ── Task Description with Edit ── */}
          <div className="flex items-start gap-2">
            <p className="text-xs text-muted-foreground flex-1">{task.description}</p>
            <EditWithImpact label="Task Description" projectId={projectId} section="task" sectionId={task.id} sectionTitle={task.title} currentValue={task.description ?? ""} onSave={() => {}} viewRole={viewRole} />
          </div>

          {/* ── Approach / AI Plan (collapsible) ── */}
          <div>
            <button
              className="flex items-center gap-2 w-full text-left"
              onClick={(e) => { e.stopPropagation(); setShowPlan(!showPlan); }}
            >
              <Brain className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Approach / Plan</span>
              {showPlan ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </button>
            {showPlan && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">{task.approach}</p>
              </div>
            )}
          </div>

          {/* ── Steps (collapsible) ── */}
          {(task.steps ?? []).length > 0 && (() => {
            const stepPct = Math.round((completedSteps / (task.steps ?? []).length) * 100);
            const filledBlocks = Math.round(stepPct / 10);
            const emptyBlocks = 10 - filledBlocks;
            const categoryColors: Record<string, string> = {
              design: "bg-purple-100 text-purple-700 border-purple-200",
              development: "bg-blue-100 text-blue-700 border-blue-200",
              review: "bg-amber-100 text-amber-700 border-amber-200",
              testing: "bg-green-100 text-green-700 border-green-200",
              deployment: "bg-red-100 text-red-700 border-red-200",
              documentation: "bg-cyan-100 text-cyan-700 border-cyan-200",
              research: "bg-indigo-100 text-indigo-700 border-indigo-200",
              integration: "bg-teal-100 text-teal-700 border-teal-200",
            };
            const reviewBadge: Record<string, { label: string; color: string }> = {
              approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
              pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-700" },
              changes_requested: { label: "Changes Requested", color: "bg-red-100 text-red-700" },
            };
            return (
              <div>
                <button
                  className="flex items-center gap-2 w-full text-left"
                  onClick={(e) => { e.stopPropagation(); setShowSteps(!showSteps); }}
                >
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Steps ({completedSteps}/{(task.steps ?? []).length})
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono tracking-tight">
                    {"━".repeat(filledBlocks)}{"░".repeat(emptyBlocks)} {stepPct}%
                  </span>
                  {showSteps ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </button>
                {showSteps && (
                  <div className="mt-2 space-y-2">
                    {(task.steps ?? []).map(step => {
                      const catColor = categoryColors[step.category ?? ""] || "bg-gray-100 text-gray-700 border-gray-200";
                      const stepAssignee = step.assignee_id && step.assignee_id !== task.assignee_id ? getUser(step.assignee_id) : null;
                      const review = step.review_status && step.review_status !== "not_needed" ? reviewBadge[step.review_status] : null;
                      return (
                        <div key={step.id} className="text-xs p-2.5 rounded-lg border border-gray-100 bg-gray-50/80 space-y-1.5">
                          {/* Row 1: status icon, category badge, description, hours */}
                          <div className="flex items-center gap-2">
                            {stepStatusIcon(step.status)}
                            {step.category && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${catColor}`}>
                                {step.category.charAt(0).toUpperCase() + step.category.slice(1)}
                              </span>
                            )}
                            <span className={step.status === "completed" ? "text-muted-foreground" : "font-medium"}>{step.description}</span>
                            {step.estimated_hours != null && (
                              <span className="ml-auto text-[10px] text-muted-foreground shrink-0 font-mono">
                                {step.actual_hours != null ? `${step.actual_hours}/${step.estimated_hours}h` : `${step.estimated_hours}h`}
                              </span>
                            )}
                            {stepAssignee && (
                              <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: stepAssignee.avatar_color }} title={stepAssignee.name}>
                                {stepAssignee.name[0]}
                              </div>
                            )}
                          </div>
                          {/* Row 2: expected outcome */}
                          {step.expected_outcome && (
                            <div className="flex items-start gap-1.5 pl-6">
                              <Target className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-[11px] text-muted-foreground leading-snug">{step.expected_outcome}</span>
                            </div>
                          )}
                          {/* Row 3: review status + notes */}
                          {(review || step.notes) && (
                            <div className="flex items-center gap-2 pl-6 flex-wrap">
                              {review && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${review.color}`}>
                                  {review.label}
                                </span>
                              )}
                              {step.notes && (
                                <span className="text-[10px] italic text-muted-foreground">&ldquo;{step.notes}&rdquo;</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Success & Kill Criteria (inline, compact) ── */}
          {((task.success_criteria?.length ?? 0) > 0 || (task.kill_criteria?.length ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {(task.success_criteria?.length ?? 0) > 0 && (
                <div>
                  <h6 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Success Criteria
                  </h6>
                  <div className="space-y-0.5">
                    {task.success_criteria.map((sc, i) => (
                      <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{sc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(task.kill_criteria?.length ?? 0) > 0 && (
                <div>
                  <h6 className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-1 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Kill Criteria
                  </h6>
                  <div className="space-y-0.5">
                    {task.kill_criteria.map((kc, i) => (
                      <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                        <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0 mt-0.5" />
                        <span>{kc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Task Outcome ── */}
          <Separator />

          {/* ══════ MILESTONES — The Core Hierarchy ══════ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Milestones ({completedMilestones}/{(task.milestones ?? []).length})
              </h5>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1 text-muted-foreground">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {(task.milestones ?? []).map(ms => (
                <MilestoneSection key={ms.id} milestone={ms} taskAssignee={task.assignee_id ?? ""} viewRole={viewRole} projectId={projectId} projectTitle={projectTitle} />
              ))}
            </div>
          </div>

          {/* ── Deadline Extensions (inline) ── */}
          {(task.deadline_extensions ?? []).length > 0 && (
            <>
              <Separator />
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5 mb-2">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Deadline Extensions ({(task.deadline_extensions ?? []).filter(de => de.status === "pending").length} pending)
                </h5>
                <div className="space-y-2">
                  {(task.deadline_extensions ?? []).map(de => {
                    const requester = getUser(de.requested_by);
                    return (
                      <div key={de.id} className={`rounded-lg border p-3 space-y-2 ${
                        de.status === "pending" ? "border-amber-200 bg-amber-50/50" :
                        de.status === "approved" ? "border-emerald-200 bg-emerald-50/30" :
                        "border-red-200 bg-red-50/30"
                      }`}>
                        <div className="flex items-center gap-2">
                          {requester && <Avatar userId={de.requested_by} size="sm" />}
                          <span className="text-xs font-medium">{requester?.name}</span>
                          <Badge variant="outline" className="text-[9px]">{de.reason.replace("_", " ")}</Badge>
                          <Badge variant="outline" className={`text-[9px] ml-auto ${
                            de.status === "pending" ? "text-amber-700 bg-amber-50" :
                            de.status === "approved" ? "text-emerald-700 bg-emerald-50" :
                            "text-red-700 bg-red-50"
                          }`}>{de.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{de.reason_detail}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {de.original_deadline && <span>Original: {formatShortDate(de.original_deadline)}</span>}
                          <span>→</span>
                          <span className="font-medium">Requested: {formatShortDate(de.requested_deadline)}</span>
                        </div>
                        {de.impact && (
                          <p className="text-[10px] text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200">{de.impact}</p>
                        )}
                        {de.status === "pending" && viewRole === "ceo" && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700">
                              <ShieldCheck className="h-3 w-3" /> Approve
                            </Button>
                            <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-red-600 border-red-200 hover:bg-red-50">
                              <ShieldX className="h-3 w-3" /> Reject
                            </Button>
                            <AttachmentBar label="Attach" compact />
                          </div>
                        )}
                        {de.status === "pending" && viewRole === "team_member" && (
                          <div className="text-[10px] text-amber-600 italic flex items-center gap-1">
                            <Hourglass className="h-3 w-3" /> Awaiting CEO decision
                          </div>
                        )}
                        {de.ceo_comment && (
                          <div className="rounded p-2 bg-blue-50 border border-blue-200">
                            <p className="text-[10px] text-blue-700"><span className="font-medium">CEO:</span> {de.ceo_comment}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Task-level Updates ── */}
          {(task.updates ?? []).length > 0 && (
            <>
              <Separator />
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-purple-600 flex items-center gap-1.5 mb-2">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Progress Updates
                </h5>
                <div className="space-y-1.5">
                  {(task.updates ?? []).map(upd => {
                    const updUser = getUser(upd.user_id);
                    return (
                      <div key={upd.id} className="p-2 rounded bg-gray-50 border border-border text-xs">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {updUser && <Avatar userId={upd.user_id} size="sm" />}
                          <span className="font-medium text-[11px]">{updUser?.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{formatShortDate(upd.created_at)}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{upd.message}</p>
                        {upd.revised_estimate && (
                          <p className="text-amber-600 mt-0.5 text-[10px]">Revised estimate: {upd.revised_estimate}h</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Add Update Input ── */}
          {showAddUpdate && (
            <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">New Update</span>
                <button onClick={() => setShowAddUpdate(false)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
              </div>
              <Textarea
                placeholder="Describe your progress, blockers, or changes..."
                className="text-[11px] min-h-[60px] resize-none"
                value={updateText}
                onChange={e => setUpdateText(e.target.value)}
              />
              <AttachmentBar label="Attach supporting document" compact />
              <div className="flex gap-2">
                <Button size="sm" className="text-[10px] h-6 gap-1 bg-purple-600 hover:bg-purple-700">
                  <Send className="h-3 w-3" /> Post Update
                </Button>
              </div>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {viewRole === "ceo" && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1">
                  <Pencil className="h-3 w-3" /> Edit Task
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={() => setShowAddUpdate(!showAddUpdate)}>
                  <MessageSquare className="h-3 w-3" /> {showAddUpdate ? "Cancel" : "Give Feedback"}
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1">
                  <UserPlus className="h-3 w-3" /> Reassign
                </Button>
              </>
            )}
            {viewRole === "team_member" && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={() => setShowAddUpdate(!showAddUpdate)}>
                  <Plus className="h-3 w-3" /> {showAddUpdate ? "Cancel" : "Add Update"}
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1">
                  <Upload className="h-3 w-3" /> Upload Document
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1">
                  <CalendarClock className="h-3 w-3" /> Request Extension
                </Button>
              </>
            )}
          </div>

          {/* ── Review Section ── */}
          {viewRole === "ceo" && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {!showReview ? (
                <Button variant="outline" size="sm" className="text-[11px] h-7 gap-1" onClick={() => setShowReview(true)}>
                  <ShieldCheck className="h-3 w-3" /> Review
                </Button>
              ) : (
                <div className="space-y-2">
                  <Textarea placeholder="Feedback (optional)..." value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} className="text-xs" rows={2} />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="text-[11px] h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                      updateTaskReviewStatus(projectId, task.id, "approved", "u1", reviewFeedback || undefined);
                      setShowReview(false); setReviewFeedback(""); onReviewUpdate?.();
                    }}>
                      <CheckCircle2 className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => {
                      updateTaskReviewStatus(projectId, task.id, "changes_requested", "u1", reviewFeedback || undefined);
                      setShowReview(false); setReviewFeedback(""); onReviewUpdate?.();
                    }}>
                      <RotateCcw className="h-3 w-3" /> Request Changes
                    </Button>
                    <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1 text-red-600 border-red-300 hover:bg-red-50" onClick={() => {
                      updateTaskReviewStatus(projectId, task.id, "rejected", "u1", reviewFeedback || undefined);
                      setShowReview(false); setReviewFeedback(""); onReviewUpdate?.();
                    }}>
                      <XCircle className="h-3 w-3" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[11px] h-7" onClick={() => setShowReview(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {viewRole === "team_member" && task.review_status && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Review:</span>
                <Badge variant="outline" className={`text-[10px] ${
                  task.review_status === "approved" ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
                  task.review_status === "changes_requested" ? "text-amber-600 bg-amber-50 border-amber-200" :
                  task.review_status === "rejected" ? "text-red-600 bg-red-50 border-red-200" :
                  "text-blue-600 bg-blue-50 border-blue-200"
                }`}>
                  {task.review_status === "approved" ? "Approved" :
                   task.review_status === "changes_requested" ? "Changes Requested" :
                   task.review_status === "rejected" ? "Rejected" :
                   "Pending Review"}
                </Badge>
                </div>
              {task.review_feedback && (
                <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{task.review_feedback}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── REQUIREMENT DOCUMENT SECTION ────────────────────────
// ═══════════════════════════════════════════════════════════

const changeTypeBadge: Record<string, string> = {
  initial: "text-blue-700 bg-blue-50 border-blue-200",
  refinement: "text-purple-700 bg-purple-50 border-purple-200",
  major_change: "text-red-700 bg-red-50 border-red-200",
  minor_change: "text-slate-700 bg-slate-50 border-slate-200",
  section_added: "text-emerald-700 bg-emerald-50 border-emerald-200",
  section_edited: "text-blue-700 bg-blue-50 border-blue-200",
  section_removed: "text-red-700 bg-red-50 border-red-200",
};

const impactBadge: Record<string, string> = {
  none: "text-slate-600 bg-slate-50 border-slate-200",
  design_only: "text-purple-600 bg-purple-50 border-purple-200",
  plan_and_design: "text-amber-600 bg-amber-50 border-amber-200",
  development_only: "text-blue-600 bg-blue-50 border-blue-200",
  roadmap: "text-teal-600 bg-teal-50 border-teal-200",
  all_documents: "text-red-600 bg-red-50 border-red-200",
};

const discussionTypeBadge: Record<string, string> = {
  question: "text-blue-700 bg-blue-50 border-blue-200",
  clarification: "text-cyan-700 bg-cyan-50 border-cyan-200",
  suggestion: "text-purple-700 bg-purple-50 border-purple-200",
  feedback: "text-amber-700 bg-amber-50 border-amber-200",
  approval: "text-emerald-700 bg-emerald-50 border-emerald-200",
  concern: "text-red-700 bg-red-50 border-red-200",
  action_item: "text-violet-700 bg-violet-50 border-violet-200",
  disagreement: "text-red-700 bg-red-50 border-red-200",
  resolution: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

const documentTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  requirement: { label: "Requirements", color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: <ScrollText className="h-3 w-3" /> },
  design: { label: "Design", color: "text-purple-700 bg-purple-50 border-purple-200", icon: <Layers className="h-3 w-3" /> },
  technical_roadmap: { label: "Roadmap", color: "text-blue-700 bg-blue-50 border-blue-200", icon: <Target className="h-3 w-3" /> },
  architecture: { label: "Architecture", color: "text-teal-700 bg-teal-50 border-teal-200", icon: <Database className="h-3 w-3" /> },
  api_spec: { label: "API Spec", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <Code2 className="h-3 w-3" /> },
  meeting_notes: { label: "Meeting Notes", color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Users className="h-3 w-3" /> },
  research: { label: "Research", color: "text-pink-700 bg-pink-50 border-pink-200", icon: <Lightbulb className="h-3 w-3" /> },
  test_plan: { label: "Test Plan", color: "text-green-700 bg-green-50 border-green-200", icon: <ShieldCheck className="h-3 w-3" /> },
  deployment: { label: "Deployment", color: "text-red-700 bg-red-50 border-red-200", icon: <Zap className="h-3 w-3" /> },
  user_guide: { label: "User Guide", color: "text-cyan-700 bg-cyan-50 border-cyan-200", icon: <BookOpen className="h-3 w-3" /> },
  custom: { label: "Custom", color: "text-slate-700 bg-slate-50 border-slate-200", icon: <FileText className="h-3 w-3" /> },
};

const documentStatusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "text-slate-600 bg-slate-50 border-slate-200" },
  in_review: { label: "In Review", color: "text-amber-600 bg-amber-50 border-amber-200" },
  approved: { label: "Approved", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  active: { label: "Active", color: "text-blue-600 bg-blue-50 border-blue-200" },
  archived: { label: "Archived", color: "text-gray-500 bg-gray-50 border-gray-200" },
};

function ProjectDocumentsSection({ documents, viewRole, tasks, projectId, onUpdate }: {
  documents: ProjectDocument[]; viewRole: ViewRole; tasks: Task[]; projectId: string; onUpdate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string>(documents[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"sections" | "changes" | "discussions">("sections");

  // Add Document form state
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<string>("custom");
  const [newDocDesc, setNewDocDesc] = useState("");

  // Section editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionContent, setEditSectionContent] = useState("");
  const [editSectionTitle, setEditSectionTitle] = useState("");

  // Add Section state
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");

  // Propose Change form state
  const [showProposeChange, setShowProposeChange] = useState(false);
  const [proposeTitle, setProposeTitle] = useState("");
  const [proposeDesc, setProposeDesc] = useState("");
  const [proposeChangeType, setProposeChangeType] = useState<string>("refinement");
  const [proposeImpact, setProposeImpact] = useState<string>("none");
  const [proposePrevText, setProposePrevText] = useState("");
  const [proposeNewText, setProposeNewText] = useState("");

  // Create Task from Change state
  const [showCreateTaskFromChange, setShowCreateTaskFromChange] = useState<string | null>(null);

  // Discussion state
  const [newDiscussion, setNewDiscussion] = useState("");
  const [replyToDiscussion, setReplyToDiscussion] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeDoc = documents.find(d => d.id === activeDocId) as any;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");

  const statusFlow: Array<"draft" | "in_review" | "approved" | "active"> = ["draft", "in_review", "approved", "active"];

  return (
    <Card>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Project Documents</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {documents.length} document{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] text-indigo-600 bg-indigo-50 border-indigo-200">
          {documents.length}
        </Badge>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {/* Document Tabs + Add Document Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {documents.map(doc => {
              const typeConf = documentTypeConfig[doc.type] || documentTypeConfig.custom;
              const isActive = doc.id === activeDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => { setActiveDocId(doc.id); setActiveTab("sections"); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                    isActive
                      ? typeConf.color + " ring-1 ring-offset-1 ring-current"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {typeConf.icon}
                  <span className="max-w-[120px] truncate">{doc.title}</span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); removeDocument(projectId, doc.id); onUpdate?.(); }}
                    className="ml-0.5 rounded-full hover:bg-red-100 hover:text-red-600 p-0.5 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setShowAddDocument(!showAddDocument)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Document
            </button>
          </div>

          {/* Add Document Form */}
          {showAddDocument && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">New Document</span>
                <button onClick={() => setShowAddDocument(false)} className="text-muted-foreground hover:text-gray-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="text-[10px] text-indigo-700 font-medium">Type</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {Object.entries(documentTypeConfig).map(([key, conf]) => (
                    <button
                      key={key}
                      onClick={() => setNewDocType(key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                        newDocType === key ? conf.color : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {conf.icon} {conf.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-indigo-700 font-medium">Title</label>
                <Input
                  placeholder="e.g. Architecture Decision Record"
                  className="text-[11px] h-8 mt-0.5 border-indigo-200 focus-visible:ring-indigo-400"
                  value={newDocTitle}
                  onChange={e => setNewDocTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-indigo-700 font-medium">Description</label>
                <Textarea
                  placeholder="Brief description of the document purpose..."
                  className="text-[11px] min-h-[50px] resize-none mt-0.5 border-indigo-200 focus-visible:ring-indigo-400"
                  value={newDocDesc}
                  onChange={e => setNewDocDesc(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-[10px] h-7 gap-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                  if (newDocTitle.trim()) {
                    addDocument(projectId, {
                      type: newDocType as any,
                      title: newDocTitle,
                      description: newDocDesc,
                      createdBy: "u1",
                    });
                    setNewDocTitle("");
                    setNewDocDesc("");
                    setNewDocType("custom");
                    setShowAddDocument(false);
                    onUpdate?.();
                  }
                }}>
                  <Plus className="h-3 w-3" /> Create Document
                </Button>
                <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowAddDocument(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Active Document Content */}
          {activeDoc && (
            <div className="space-y-3">
              {/* Document Header */}
              <div className="rounded-lg border border-border bg-white p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold">{activeDoc.title}</span>
                  <Badge variant="outline" className={`text-[9px] ${documentTypeConfig[activeDoc.type]?.color || ""}`}>
                    {documentTypeConfig[activeDoc.type]?.label || activeDoc.type}
                  </Badge>
                  <Badge variant="outline" className={`text-[9px] ${documentStatusConfig[activeDoc.status]?.color || ""}`}>
                    {documentStatusConfig[activeDoc.status]?.label || activeDoc.status}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground ml-auto">
                    v{activeDoc.currentVersion} &middot; Updated {formatShortDate(activeDoc.lastUpdated)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{activeDoc.description}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Created by {getUser(activeDoc.createdBy)?.name}</span>
                  <span>&middot;</span>
                  <span>{formatShortDate(activeDoc.createdAt)}</span>
                </div>

                {/* Status Actions (CEO can change status) */}
                {viewRole === "ceo" && (
                  <div className="flex items-center gap-1.5 pt-1 border-t border-dashed border-gray-200">
                    <span className="text-[9px] text-muted-foreground font-medium">Status:</span>
                    {statusFlow.map(s => {
                      const sc = documentStatusConfig[s];
                      return (
                        <button
                          key={s}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium border transition-colors ${
                            activeDoc.status === s ? sc.color + " ring-1 ring-current" : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Cross-Reference Panel */}
                {activeDoc.linkedDocumentIds && activeDoc.linkedDocumentIds.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-dashed border-gray-200">
                    <LinkIcon className="h-3 w-3 shrink-0" />
                    <span className="font-medium">Related:</span>
                    {activeDoc.linkedDocumentIds.map((lid: string) => {
                      const linkedDoc = documents.find(d => d.id === lid);
                      if (!linkedDoc) return null;
                      return (
                        <button
                          key={lid}
                          onClick={() => { setActiveDocId(lid); setActiveTab("sections"); }}
                          className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                        >
                          {linkedDoc.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 border-b border-border">
                {([
                  { key: "sections" as const, label: `Sections (${activeDoc.sections.length})`, icon: <BookOpen className="h-3 w-3" /> },
                  { key: "changes" as const, label: `Changes (${activeDoc.changes.length})`, icon: <GitCommit className="h-3 w-3" /> },
                  { key: "discussions" as const, label: `Discussions (${activeDoc.discussions.length})`, icon: <MessageCircle className="h-3 w-3" /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-muted-foreground hover:text-gray-700"
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Sections Tab ── */}
              {activeTab === "sections" && (
                <div className="space-y-2">
                  {activeDoc.sections.sort((a: any, b: any) => a.order - b.order).map((section: any) => (
                    <div key={section.id} className="rounded-lg border border-border bg-white p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        {editingSectionId === section.id ? (
                          <Input
                            className="text-xs font-semibold h-7 w-1/2 border-indigo-200"
                            value={editSectionTitle}
                            onChange={e => setEditSectionTitle(e.target.value)}
                          />
                        ) : (
                          <span className="text-xs font-semibold">{section.title}</span>
                        )}
                        <div className="flex items-center gap-2">
                          {section.isCustom && (
                            <Badge variant="outline" className="text-[8px] text-violet-600 bg-violet-50 border-violet-200">custom</Badge>
                          )}
                          <span className="text-[9px] text-muted-foreground">
                            {getUser(section.lastModifiedBy)?.name} &middot; {formatShortDate(section.lastModifiedAt)}
                          </span>
                          {(viewRole === "ceo" || viewRole === "team_member") && editingSectionId !== section.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[9px] h-5 px-1.5 text-indigo-600 hover:bg-indigo-50"
                              onClick={() => {
                                setEditingSectionId(section.id);
                                setEditSectionContent(section.content);
                                setEditSectionTitle(section.title);
                              }}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {editingSectionId === section.id ? (
                        <div className="space-y-2">
                          <Textarea
                            className="text-[11px] min-h-[80px] resize-none border-indigo-200"
                            value={editSectionContent}
                            onChange={e => setEditSectionContent(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="text-[10px] h-6 gap-1 bg-indigo-600 hover:bg-indigo-700">
                              <CheckCircle2 className="h-3 w-3" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setEditingSectionId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>
                          <div className="mt-1">
                            <EditWithImpact label="Section Content" projectId={projectId} section="document" sectionId={section.id} sectionTitle={section.title} currentValue={section.content} onSave={() => {}} viewRole={viewRole} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Section */}
                  {!showAddSection ? (
                    <button
                      onClick={() => setShowAddSection(true)}
                      className="flex items-center gap-1.5 px-3 py-2 w-full rounded-lg border border-dashed border-indigo-300 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add Section
                    </button>
                  ) : (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">New Section</span>
                        <button onClick={() => setShowAddSection(false)} className="text-muted-foreground hover:text-gray-700">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Input
                        placeholder="Section title"
                        className="text-[11px] h-7 border-indigo-200"
                        value={newSectionTitle}
                        onChange={e => setNewSectionTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="Section content..."
                        className="text-[11px] min-h-[60px] resize-none border-indigo-200"
                        value={newSectionContent}
                        onChange={e => setNewSectionContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="text-[10px] h-6 gap-1 bg-indigo-600 hover:bg-indigo-700">
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowAddSection(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Changes Tab ── */}
              {activeTab === "changes" && (
                <div className="relative">
                  <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-amber-300 via-indigo-300 to-purple-300" />
                  <div className="space-y-3">
                    {activeDoc.changes.map((change: any) => {
                      const changer = getUser(change.changedBy);
                      return (
                        <div key={change.id} className="relative pl-8">
                          <div className={`absolute left-1.5 top-3 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                            change.changeType === "major_change" ? "bg-red-500" :
                            change.changeType === "refinement" ? "bg-purple-500" :
                            change.changeType === "section_added" ? "bg-emerald-500" :
                            change.changeType === "section_edited" ? "bg-blue-500" :
                            change.changeType === "section_removed" ? "bg-red-400" :
                            change.changeType === "initial" ? "bg-blue-500" : "bg-slate-400"
                          }`} />
                          <div className="rounded-lg border border-border bg-white p-3 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold">v{change.version}</span>
                              <Badge variant="outline" className={`text-[9px] ${changeTypeBadge[change.changeType] || ""}`}>
                                {change.changeType.replace(/_/g, " ")}
                              </Badge>
                              <Badge variant="outline" className={`text-[9px] ${impactBadge[change.impact] || ""}`}>
                                {change.impact.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">{formatShortDate(change.createdAt)}</span>
                            </div>
                            <p className="text-[11px] font-medium">{change.title}</p>
                            <p className="text-[11px] text-muted-foreground">{change.description}</p>
                            {changer && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Avatar userId={change.changedBy} size="sm" />
                                <span>{changer.name}</span>
                              </div>
                            )}
                            {change.previousText && change.newText && (
                              <div className="space-y-1 mt-1">
                                <div className="rounded p-2 bg-red-50 border border-red-200 text-[10px]">
                                  <span className="font-medium text-red-600">Previous: </span>
                                  <span className="text-red-800">{change.previousText}</span>
                                </div>
                                <div className="flex items-center justify-center">
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="rounded p-2 bg-emerald-50 border border-emerald-200 text-[10px]">
                                  <span className="font-medium text-emerald-600">New: </span>
                                  <span className="text-emerald-800">{change.newText}</span>
                                </div>
                              </div>
                            )}
                            {/* Cross-document impact indicator */}
                            {change.linkedDocumentIds && change.linkedDocumentIds.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span className="font-medium">Also impacts:</span>
                                {change.linkedDocumentIds.map((lid: string) => {
                                  const linkedDoc = documents.find(d => d.id === lid);
                                  return linkedDoc ? (
                                    <button
                                      key={lid}
                                      onClick={() => { setActiveDocId(lid); setActiveTab("sections"); }}
                                      className="text-amber-800 underline underline-offset-2 hover:text-amber-900"
                                    >
                                      {linkedDoc.title}
                                    </button>
                                  ) : null;
                                })}
                              </div>
                            )}
                            {change.approvedBy && change.approvedBy.length > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                                <ShieldCheck className="h-3 w-3" />
                                Approved by {change.approvedBy.map((uid: string) => getUser(uid)?.name).filter(Boolean).join(", ")}
                              </div>
                            )}

                            {/* Create Task from This Change */}
                            {change.impact !== "none" && (
                              <div className="pt-1 border-t border-dashed border-gray-200">
                                {showCreateTaskFromChange !== change.id ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-[10px] h-6 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                                    onClick={() => setShowCreateTaskFromChange(change.id)}
                                  >
                                    <ClipboardList className="h-3 w-3" /> Create Task
                                  </Button>
                                ) : (
                                  <ReviewTaskPanel
                                    onClose={() => setShowCreateTaskFromChange(null)}
                                    sourceType="task"
                                    sourceTitle={`RE: ${activeDoc.title} Change v${change.version} — ${change.title}`}
                                    projectId={projectId}
                                    projectTitle=""
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Propose Change Form */}
                  <div className="mt-4">
                    {!showProposeChange ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={() => setShowProposeChange(true)}
                      >
                        <Plus className="h-3.5 w-3.5" /> {viewRole === "ceo" ? "Add Change" : "Propose Change"}
                      </Button>
                    ) : (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                            <GitCommit className="h-3.5 w-3.5" />
                            {viewRole === "ceo" ? "Add Change" : "Propose Change"}
                          </span>
                          <button onClick={() => setShowProposeChange(false)} className="text-muted-foreground hover:text-gray-700">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] text-amber-700 font-medium">Title</label>
                          <Input
                            placeholder="e.g. Update API response format"
                            className="text-[11px] h-8 mt-0.5 border-amber-200 focus-visible:ring-amber-400"
                            value={proposeTitle}
                            onChange={e => setProposeTitle(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-amber-700 font-medium">Description</label>
                          <Textarea
                            placeholder="Describe the change and why it is needed..."
                            className="text-[11px] min-h-[60px] resize-none mt-0.5 border-amber-200 focus-visible:ring-amber-400"
                            value={proposeDesc}
                            onChange={e => setProposeDesc(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-amber-700 font-medium">Change Type</label>
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {(["refinement", "major_change", "minor_change", "section_added", "section_edited", "section_removed"] as const).map(ct => (
                                <button
                                  key={ct}
                                  onClick={() => setProposeChangeType(ct)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                                    proposeChangeType === ct
                                      ? changeTypeBadge[ct]
                                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  {ct.replace(/_/g, " ")}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-amber-700 font-medium">Impact</label>
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {(["none", "design_only", "plan_and_design", "development_only", "roadmap", "all_documents"] as const).map(imp => (
                                <button
                                  key={imp}
                                  onClick={() => setProposeImpact(imp)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                                    proposeImpact === imp
                                      ? impactBadge[imp]
                                      : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                                  }`}
                                >
                                  {imp.replace(/_/g, " ")}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Impact Analysis Callout */}
                        <div className={`rounded-lg border p-2.5 text-[11px] ${
                          proposeImpact === "none" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                          proposeImpact === "design_only" ? "border-blue-200 bg-blue-50 text-blue-700" :
                          proposeImpact === "plan_and_design" ? "border-amber-200 bg-amber-50 text-amber-700" :
                          proposeImpact === "roadmap" ? "border-teal-200 bg-teal-50 text-teal-700" :
                          proposeImpact === "all_documents" ? "border-red-200 bg-red-50 text-red-700" :
                          "border-purple-200 bg-purple-50 text-purple-700"
                        }`}>
                          <div className="flex items-start gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium">Impact Analysis: </span>
                              {proposeImpact === "none" && "No impact on existing tasks or design"}
                              {proposeImpact === "design_only" && "Will require updates to design documents and architecture"}
                              {proposeImpact === "plan_and_design" && "Will impact project plan, timeline, and design. Affected tasks may need revision."}
                              {proposeImpact === "development_only" && "Will require changes to in-progress development tasks"}
                              {proposeImpact === "roadmap" && "Will impact the project roadmap and delivery timeline"}
                              {proposeImpact === "all_documents" && "Major change affecting all project documents. Full review required."}

                              {(proposeImpact === "plan_and_design" || proposeImpact === "development_only" || proposeImpact === "all_documents") && inProgressTasks.length > 0 && (
                                <div className="mt-1.5 space-y-0.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider">Affected in-progress tasks:</span>
                                  {inProgressTasks.map(t => (
                                    <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
                                      <Activity className="h-2.5 w-2.5 shrink-0" />
                                      <span>{t.title}</span>
                                      <span className="text-[9px] opacity-70">({getUser(t.assignee_id ?? "")?.name})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-amber-700 font-medium">Previous Text</label>
                            <Textarea
                              placeholder="Text being replaced (optional)"
                              className="text-[11px] min-h-[50px] resize-none mt-0.5 border-amber-200"
                              value={proposePrevText}
                              onChange={e => setProposePrevText(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-amber-700 font-medium">New Text</label>
                            <Textarea
                              placeholder="New or updated text (optional)"
                              className="text-[11px] min-h-[50px] resize-none mt-0.5 border-amber-200"
                              value={proposeNewText}
                              onChange={e => setProposeNewText(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" className="text-[10px] h-7 gap-1 bg-amber-600 hover:bg-amber-700">
                            <Send className="h-3 w-3" /> {viewRole === "ceo" ? "Apply Change" : "Submit Change for Review"}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowProposeChange(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Discussions Tab ── */}
              {activeTab === "discussions" && (
                <div className="space-y-2">
                  {activeDoc.discussions.map((disc: any) => {
                    const discUser = getUser(disc.userId);
                    const sectionRef = disc.sectionId ? activeDoc.sections.find((s: any) => s.id === disc.sectionId) : null;
                    return (
                      <div key={disc.id} className={`rounded-lg border p-3 space-y-1.5 ${
                        disc.resolved ? "border-emerald-200 bg-emerald-50/30" : "border-border bg-white"
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {discUser && <Avatar userId={disc.userId} size="sm" />}
                          <span className="text-[11px] font-medium">{discUser?.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${discussionTypeBadge[disc.type] || ""}`}>
                            {disc.type.replace(/_/g, " ")}
                          </Badge>
                          {disc.resolved && (
                            <Badge variant="outline" className="text-[9px] text-emerald-600 bg-emerald-50 border-emerald-200">
                              resolved
                            </Badge>
                          )}
                          {sectionRef && (
                            <span className="text-[9px] text-indigo-600 flex items-center gap-0.5">
                              <BookOpen className="h-2.5 w-2.5" /> {sectionRef.title}
                            </span>
                          )}
                          {disc.linkedChangeId && (
                            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                              <Hash className="h-2.5 w-2.5" /> {disc.linkedChangeId}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">{formatShortDate(disc.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{disc.message}</p>

                        {/* Reply / Resolve buttons for unresolved discussions */}
                        {!disc.resolved && (
                          <div className="pt-1.5 border-t border-dashed border-gray-200 space-y-2">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-6 gap-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                                onClick={() => { setReplyToDiscussion(replyToDiscussion === disc.id ? null : disc.id); setReplyText(""); }}
                              >
                                <MessageCircle className="h-3 w-3" /> Reply
                              </Button>
                              {viewRole === "ceo" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Mark Resolved
                                </Button>
                              )}
                            </div>
                            {replyToDiscussion === disc.id && (
                              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-2.5 space-y-2">
                                <Textarea
                                  placeholder="Write your reply..."
                                  className="text-[11px] min-h-[40px] resize-none border-purple-200"
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="text-[10px] h-6 gap-1 bg-purple-600 hover:bg-purple-700">
                                    <Send className="h-3 w-3" /> Send Reply
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setReplyToDiscussion(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add discussion input */}
                  <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                    <Textarea
                      placeholder={viewRole === "ceo" ? "Add feedback or approve changes..." : "Submit a refinement or question..."}
                      className="text-[11px] min-h-[50px] resize-none"
                      value={newDiscussion}
                      onChange={e => setNewDiscussion(e.target.value)}
                    />
                    <div className="flex gap-2">
                      {viewRole === "ceo" && (
                        <Button size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> Approve
                        </Button>
                      )}
                      <Button size="sm" className="text-[10px] h-6 gap-1 bg-purple-600 hover:bg-purple-700">
                        <Send className="h-3 w-3" /> {viewRole === "ceo" ? "Add Feedback" : "Submit"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── PHASES TIMELINE SECTION ─────────────────────────────
// ═══════════════════════════════════════════════════════════

const phaseStatusColors: Record<string, string> = {
  pending: "text-slate-600 bg-slate-50 border-slate-200",
  active: "text-blue-700 bg-blue-50 border-blue-200",
  in_discussion: "text-amber-700 bg-amber-50 border-amber-200",
  completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

const attachmentTypeBadge: Record<string, { color: string; icon: React.ReactNode }> = {
  document: { color: "text-blue-700 bg-blue-50 border-blue-200", icon: <FileText className="h-2.5 w-2.5" /> },
  mom: { color: "text-teal-700 bg-teal-50 border-teal-200", icon: <Users className="h-2.5 w-2.5" /> },
  feedback: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: <MessageSquare className="h-2.5 w-2.5" /> },
  proof: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <ShieldCheck className="h-2.5 w-2.5" /> },
  architecture: { color: "text-purple-700 bg-purple-50 border-purple-200", icon: <Database className="h-2.5 w-2.5" /> },
  prototype: { color: "text-pink-700 bg-pink-50 border-pink-200", icon: <Zap className="h-2.5 w-2.5" /> },
};

function PhasesTimelineSection({ phases, viewRole, projectId }: { phases: Phase[]; viewRole: ViewRole; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach(p => { if (p.status === "active") initial[p.id] = true; });
    return initial;
  });

  // Per-phase interactive state
  const [phaseAddDiscussion, setPhaseAddDiscussion] = useState<string | null>(null);
  const [phaseDiscText, setPhaseDiscText] = useState("");
  const [phaseDiscType, setPhaseDiscType] = useState<string>("question");
  const [phaseAddAttachment, setPhaseAddAttachment] = useState<string | null>(null);
  const [phaseAttTitle, setPhaseAttTitle] = useState("");
  const [phaseAttType, setPhaseAttType] = useState<string>("document");

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Flag className="h-5 w-5 text-blue-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Project Phases</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {phases.filter(p => p.status === "completed").length}/{phases.length} completed
            {phases.find(p => p.status === "active") && ` \u00b7 Active: ${phases.find(p => p.status === "active")?.phase_name}`}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {phases.sort((a, b) => a.order_index - b.order_index).map(phase => {
            const checklistDone = phase.checklist.filter(c => c.done).length;
            const checklistTotal = phase.checklist.length;
            const phasePct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
            const isExpanded = expandedPhases[phase.id] || false;

            return (
              <div key={phase.id} className={`rounded-lg border ${
                phase.status === "active" ? "border-blue-300 bg-blue-50/30 ring-1 ring-blue-200" :
                phase.status === "completed" ? "border-emerald-200 bg-emerald-50/20" :
                phase.status === "in_discussion" ? "border-amber-200 bg-amber-50/20" :
                "border-border bg-gray-50/30"
              }`}>
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/50 transition-colors rounded-lg"
                  onClick={() => togglePhase(phase.id)}
                >
                  {phase.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
                   phase.status === "active" ? <Activity className="h-4 w-4 text-blue-500 shrink-0 animate-pulse" /> :
                   phase.status === "in_discussion" ? <MessageCircle className="h-4 w-4 text-amber-500 shrink-0" /> :
                   <Circle className="h-4 w-4 text-gray-300 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{phase.phase_name}</span>
                      <Badge variant="outline" className={`text-[9px] ${phaseStatusColors[phase.status] || ""}`}>
                        {phase.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{phase.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{phase.estimated_duration}</span>
                    {phase.start_date && phase.end_date && (
                      <span className="text-[10px] text-gray-500">
                        {formatShortDate(phase.start_date)} → {formatShortDate(phase.end_date)}
                      </span>
                    )}
                    {checklistTotal > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">{phasePct}%</span>
                    )}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                </div>

                {/* Progress bar */}
                {checklistTotal > 0 && (
                  <div className="px-3 pb-1">
                    <Progress value={phasePct} className="h-1" />
                  </div>
                )}

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-2.5">
                    {/* Phase Description Edit */}
                    <div className="flex items-start gap-2">
                      <p className="text-[11px] text-muted-foreground flex-1">{phase.description}</p>
                      <EditWithImpact label="Phase Description" projectId={projectId} section="phase" sectionId={phase.id} sectionTitle={phase.phase_name} currentValue={phase.description ?? ""} onSave={() => {}} viewRole={viewRole} />
                    </div>
                    {/* Checklist */}
                    {phase.checklist.length > 0 && (
                      <div>
                        <h6 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                          <List className="h-3 w-3" /> Checklist ({checklistDone}/{checklistTotal})
                        </h6>
                        <div className="space-y-1">
                          {phase.checklist.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <Checkbox checked={item.done} disabled />
                              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Phase Discussions */}
                    {(phase.discussions ?? []).length > 0 && (
                      <div>
                        <h6 className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1.5 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> Discussions ({(phase.discussions ?? []).length})
                        </h6>
                        <div className="space-y-1.5">
                          {(phase.discussions ?? []).map(disc => {
                            const discUser = getUser(disc.user_id);
                            return (
                              <div key={disc.id} className="rounded border border-border bg-white p-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  {discUser && <Avatar userId={disc.user_id} size="sm" />}
                                  <span className="text-[11px] font-medium">{discUser?.name}</span>
                                  <Badge variant="outline" className={`text-[9px] ${discussionTypeBadge[disc.type] || ""}`}>
                                    {disc.type}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground ml-auto">{formatShortDate(disc.created_at)}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{disc.message}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Phase Attachments */}
                    {(phase.attachments ?? []).length > 0 && (
                      <div>
                        <h6 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> Attachments ({(phase.attachments ?? []).length})
                        </h6>
                        <div className="space-y-1">
                          {(phase.attachments ?? []).map(att => {
                            const attConfig = attachmentTypeBadge[att.type] || { color: "text-gray-600 bg-gray-50 border-gray-200", icon: <FileText className="h-2.5 w-2.5" /> };
                            return (
                              <div key={att.id} className="flex items-center gap-2 text-[11px] p-1.5 rounded border border-border bg-white">
                                <Badge variant="outline" className={`text-[9px] gap-0.5 ${attConfig.color}`}>
                                  {attConfig.icon} {att.type.replace("_", " ")}
                                </Badge>
                                <span className="font-medium truncate flex-1">{att.title}</span>
                                <span className="text-[9px] text-muted-foreground">{getUser(att.uploaded_by ?? "")?.name}</span>
                                {att.url && (
                                  <a href={att.url} className="text-blue-600 hover:text-blue-800">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Sign-off status */}
                    <div className="flex items-center gap-2 text-[10px]">
                      {phase.sign_off_required && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Sign-off required
                        </span>
                      )}
                      {phase.signed_off_by && phase.signed_off_by.length > 0 && (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Signed off by {phase.signed_off_by.map(uid => getUser(uid)?.name).filter(Boolean).join(", ")}
                        </span>
                      )}
                      {phase.sign_off_required && (!phase.signed_off_by || phase.signed_off_by.length === 0) && (
                        <span className="text-muted-foreground italic">Pending sign-off</span>
                      )}
                    </div>

                    {/* ── Phase Action Buttons ── */}
                    <Separator />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 gap-1 text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={() => { setPhaseAddDiscussion(phaseAddDiscussion === phase.id ? null : phase.id); setPhaseDiscText(""); setPhaseDiscType("question"); }}
                      >
                        <MessageCircle className="h-3 w-3" /> Add Discussion
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-7 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => { setPhaseAddAttachment(phaseAddAttachment === phase.id ? null : phase.id); setPhaseAttTitle(""); setPhaseAttType("document"); }}
                      >
                        <Paperclip className="h-3 w-3" /> Upload Attachment
                      </Button>
                      {viewRole === "ceo" && phase.sign_off_required && (!phase.signed_off_by || !phase.signed_off_by.includes("u1")) && (
                        <Button
                          size="sm"
                          className="text-[10px] h-7 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ShieldCheck className="h-3 w-3" /> Sign Off
                        </Button>
                      )}
                    </div>

                    {/* Add Discussion Form */}
                    {phaseAddDiscussion === phase.id && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">New Discussion</span>
                          <button onClick={() => setPhaseAddDiscussion(null)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
                        </div>
                        <Textarea
                          placeholder="Add a question, clarification, or comment..."
                          className="text-[11px] min-h-[50px] resize-none border-purple-200"
                          value={phaseDiscText}
                          onChange={e => setPhaseDiscText(e.target.value)}
                        />
                        <div>
                          <label className="text-[10px] text-purple-600 font-medium">Type</label>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {(["question", "clarification", "disagreement", "resolution"] as const).map(dt => (
                              <button
                                key={dt}
                                onClick={() => setPhaseDiscType(dt)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                                  phaseDiscType === dt
                                    ? discussionTypeBadge[dt] || ""
                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                                }`}
                              >
                                {dt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="text-[10px] h-6 gap-1 bg-purple-600 hover:bg-purple-700">
                            <Send className="h-3 w-3" /> Submit Discussion
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setPhaseAddDiscussion(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Upload Attachment Form */}
                    {phaseAddAttachment === phase.id && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Upload Attachment</span>
                          <button onClick={() => setPhaseAddAttachment(null)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
                        </div>
                        <div>
                          <label className="text-[10px] text-blue-600 font-medium">Title</label>
                          <Input
                            placeholder="Attachment title"
                            className="text-[11px] h-8 mt-0.5 border-blue-200 focus-visible:ring-blue-400"
                            value={phaseAttTitle}
                            onChange={e => setPhaseAttTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-blue-600 font-medium">Type</label>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            {(["document", "mom", "feedback", "proof", "architecture", "prototype"] as const).map(at => (
                              <button
                                key={at}
                                onClick={() => setPhaseAttType(at)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border flex items-center gap-1 ${
                                  phaseAttType === at
                                    ? attachmentTypeBadge[at]?.color || ""
                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                                }`}
                              >
                                {attachmentTypeBadge[at]?.icon} {at.replace("_", " ")}
                              </button>
                            ))}
                          </div>
                        </div>
                        <AttachmentBar label="Select file to upload" />
                        <div className="flex gap-2">
                          <Button size="sm" className="text-[10px] h-6 gap-1 bg-blue-600 hover:bg-blue-700">
                            <Upload className="h-3 w-3" /> Upload
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setPhaseAddAttachment(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── AI PLAN & RISK ANALYSIS SECTION ─────────────────────
// ═══════════════════════════════════════════════════════════

function AIPlanSection({ aiPlan, viewRole }: { aiPlan: AiPlan; viewRole: ViewRole }) {
  const risks = aiPlan.risks ?? [];
  const killCriteria = aiPlan.killCriteria ?? [];
  const summary = aiPlan.summary ?? "";
  const [expanded, setExpanded] = useState(false);

  // Add Risk form state (CEO)
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [newRiskDesc, setNewRiskDesc] = useState("");
  const [newRiskSeverity, setNewRiskSeverity] = useState<string>("medium");
  const [newRiskMitigation, setNewRiskMitigation] = useState("");

  // Add Kill Criteria state (CEO)
  const [showAddKillCriteria, setShowAddKillCriteria] = useState(false);
  const [newKillCriteria, setNewKillCriteria] = useState("");

  const severityColor: Record<string, string> = {
    high: "text-red-700 bg-red-50 border-red-300",
    medium: "text-amber-700 bg-amber-50 border-amber-300",
    low: "text-emerald-700 bg-emerald-50 border-emerald-300",
  };

  const severityDot: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-400",
    low: "bg-emerald-400",
  };

  return (
    <Card>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Shield className="h-5 w-5 text-purple-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">AI Plan & Risk Analysis</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {risks.length} risks identified &middot; {killCriteria.length} kill criteria
          </p>
        </div>
        {risks.some(r => r.severity === "high") && (
          <Badge className="text-[9px] bg-red-500 text-white border-0">
            High Risk
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {/* Summary */}
          <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">AI Summary</span>
            </div>
            <p className="text-[11px] text-purple-900/80 leading-relaxed">{summary}</p>
          </div>

          {/* Risks */}
          {risks.length > 0 && (
            <div>
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Risk Assessment
              </h6>
              <div className="space-y-2">
                {risks.map((risk, i) => (
                  <div key={i} className={`rounded-lg border p-3 space-y-1.5 ${severityColor[risk.severity] || "border-border"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${severityDot[risk.severity] || "bg-gray-400"}`} />
                      <Badge variant="outline" className={`text-[9px] ${severityColor[risk.severity] || ""}`}>
                        {risk.severity}
                      </Badge>
                      <span className="text-xs font-medium flex-1">{risk.risk}</span>
                    </div>
                    <div className="flex items-start gap-1.5 pl-5">
                      <Lightbulb className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-muted-foreground">{risk.mitigation}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Risk Form (CEO) */}
              {viewRole === "ceo" && (
                <div className="pt-2">
                  {!showAddRisk ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setShowAddRisk(true)}
                    >
                      <Plus className="h-3 w-3" /> Add Risk
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">Add New Risk</span>
                        <button onClick={() => setShowAddRisk(false)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
                      </div>
                      <div>
                        <label className="text-[10px] text-red-600 font-medium">Risk Description</label>
                        <Input
                          placeholder="Describe the risk..."
                          className="text-[11px] h-8 mt-0.5 border-red-200 focus-visible:ring-red-400"
                          value={newRiskDesc}
                          onChange={e => setNewRiskDesc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-red-600 font-medium">Severity</label>
                        <div className="flex gap-1.5 mt-1">
                          {(["low", "medium", "high"] as const).map(s => (
                            <button
                              key={s}
                              onClick={() => setNewRiskSeverity(s)}
                              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                                newRiskSeverity === s
                                  ? s === "low" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                    : s === "medium" ? "bg-amber-100 text-amber-700 border-amber-300"
                                    : "bg-red-100 text-red-700 border-red-300"
                                  : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-red-600 font-medium">Mitigation Strategy</label>
                        <Textarea
                          placeholder="How to mitigate this risk..."
                          className="text-[11px] min-h-[40px] resize-none mt-0.5 border-red-200"
                          value={newRiskMitigation}
                          onChange={e => setNewRiskMitigation(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-[10px] h-6 gap-1 bg-red-600 hover:bg-red-700">
                          <Plus className="h-3 w-3" /> Add Risk
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowAddRisk(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Kill Criteria */}
          {killCriteria.length > 0 && (
            <div>
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-red-700 mb-1.5 flex items-center gap-1">
                <AlertOctagon className="h-3 w-3" /> Kill Criteria
              </h6>
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-1">
                {killCriteria.map((kc, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-red-800">
                    <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                    <span>{kc}</span>
                  </div>
                ))}
              </div>

              {/* Add Kill Criterion (CEO) */}
              {viewRole === "ceo" && (
                <div className="pt-2">
                  {!showAddKillCriteria ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => setShowAddKillCriteria(true)}
                    >
                      <Plus className="h-3 w-3" /> Add Kill Criterion
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        placeholder="Enter kill criterion..."
                        className="text-[11px] h-8 border-red-200 focus-visible:ring-red-400 flex-1"
                        value={newKillCriteria}
                        onChange={e => setNewKillCriteria(e.target.value)}
                      />
                      <Button size="sm" className="text-[10px] h-8 gap-1 bg-red-600 hover:bg-red-700">
                        <Plus className="h-3 w-3" /> Add
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[10px] h-8" onClick={() => setShowAddKillCriteria(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── CHECKPOINTS SECTION ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

const decisionConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  continue: { label: "Continue", color: "text-emerald-700", bgColor: "border-emerald-300 bg-emerald-50/50", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
  kill: { label: "Kill", color: "text-red-700", bgColor: "border-red-300 bg-red-50/50", icon: <XCircle className="h-4 w-4 text-red-500" /> },
  pivot: { label: "Pivot", color: "text-amber-700", bgColor: "border-amber-300 bg-amber-50/50", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
};

function CheckpointsSection({ checkpoints, viewRole }: { checkpoints: Checkpoint[]; viewRole: ViewRole }) {
  const [expanded, setExpanded] = useState(false);

  // Add Checkpoint form state (CEO only)
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);
  const [cpDecision, setCpDecision] = useState<string>("continue");
  const [cpNotes, setCpNotes] = useState("");
  const [cpInsights, setCpInsights] = useState("");
  const [cpActions, setCpActions] = useState("");

  return (
    <Card>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Zap className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Checkpoints</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {checkpoints.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">No checkpoints recorded yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-amber-300 via-blue-300 to-emerald-300" />
              <div className="space-y-3">
                {checkpoints.map(cp => {
                  const config = decisionConfig[cp.decision] || decisionConfig.continue;
                  return (
                    <div key={cp.id} className="relative pl-8">
                      <div className={`absolute left-1 top-3 h-4 w-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${
                        cp.decision === "continue" ? "bg-emerald-500" :
                        cp.decision === "kill" ? "bg-red-500" : "bg-amber-500"
                      }`}>
                        <span className="text-white text-[7px] font-bold">
                          {cp.decision === "continue" ? "\u2713" : cp.decision === "kill" ? "\u2717" : "\u21BB"}
                        </span>
                      </div>
                      <div className={`rounded-lg border p-3 space-y-2 ${config.bgColor}`}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <Badge variant="outline" className={`text-[10px] font-semibold ${
                            cp.decision === "continue" ? "text-emerald-700 bg-emerald-50 border-emerald-300" :
                            cp.decision === "kill" ? "text-red-700 bg-red-50 border-red-300" :
                            "text-amber-700 bg-amber-50 border-amber-300"
                          }`}>
                            {config.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">{formatShortDate(cp.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-gray-700 leading-relaxed">{cp.notes}</p>
                        {cp.ai_insights && (
                          <div className="rounded p-2 bg-purple-50 border border-purple-200">
                            <div className="flex items-center gap-1 mb-1">
                              <Sparkles className="h-2.5 w-2.5 text-purple-500" />
                              <span className="text-[9px] font-semibold text-purple-700 uppercase tracking-wider">AI Insights</span>
                            </div>
                            <p className="text-[10px] text-purple-800">{cp.ai_insights}</p>
                          </div>
                        )}
                        {cp.action_items && cp.action_items.length > 0 && (
                          <div>
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Action Items</span>
                            <div className="space-y-0.5 mt-0.5">
                              {cp.action_items.map((ai, i) => (
                                <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                                  <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                                  <span>{ai}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Checkpoint Form (CEO only) */}
          {viewRole === "ceo" && (
            <div className="pt-1">
              {!showAddCheckpoint ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-8 gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setShowAddCheckpoint(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Checkpoint
                </Button>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Record Checkpoint
                    </span>
                    <button onClick={() => setShowAddCheckpoint(false)} className="text-muted-foreground hover:text-gray-700">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-700 font-medium">Decision</label>
                    <div className="flex gap-2 mt-1">
                      {(["continue", "kill", "pivot"] as const).map(d => (
                        <button
                          key={d}
                          onClick={() => setCpDecision(d)}
                          className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all border-2 ${
                            cpDecision === d
                              ? d === "continue" ? "bg-emerald-100 border-emerald-400 text-emerald-800"
                                : d === "kill" ? "bg-red-100 border-red-400 text-red-800"
                                : "bg-amber-100 border-amber-400 text-amber-800"
                              : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {d === "continue" ? "\u2713 Continue" : d === "kill" ? "\u2717 Kill" : "\u21BB Pivot"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-700 font-medium">Notes</label>
                    <Textarea
                      placeholder="Describe the checkpoint decision rationale..."
                      className="text-[11px] min-h-[60px] resize-none mt-0.5 border-amber-200 focus-visible:ring-amber-400"
                      value={cpNotes}
                      onChange={e => setCpNotes(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-700 font-medium">AI Insights (optional)</label>
                    <Textarea
                      placeholder="Add any AI-generated insights or analysis..."
                      className="text-[11px] min-h-[40px] resize-none mt-0.5 border-amber-200"
                      value={cpInsights}
                      onChange={e => setCpInsights(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-amber-700 font-medium">Action Items (comma or line separated)</label>
                    <Textarea
                      placeholder="e.g. Review design docs, Update timeline, Notify stakeholders"
                      className="text-[11px] min-h-[40px] resize-none mt-0.5 border-amber-200"
                      value={cpActions}
                      onChange={e => setCpActions(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" className="text-[10px] h-7 gap-1 bg-amber-600 hover:bg-amber-700">
                      <Zap className="h-3 w-3" /> Record Checkpoint
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowAddCheckpoint(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── TASK OUTCOME SECTION (used inside TaskCard) ─────────
// ═══════════════════════════════════════════════════════════

const outcomeTypeBadgeConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  information: { color: "text-cyan-700 bg-cyan-50 border-cyan-200", icon: <Lightbulb className="h-2.5 w-2.5" /> },
  decision: { color: "text-amber-700 bg-amber-50 border-amber-200", icon: <Flag className="h-2.5 w-2.5" /> },
  document: { color: "text-blue-700 bg-blue-50 border-blue-200", icon: <FileText className="h-2.5 w-2.5" /> },
  code: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: <Code2 className="h-2.5 w-2.5" /> },
  design: { color: "text-pink-700 bg-pink-50 border-pink-200", icon: <Presentation className="h-2.5 w-2.5" /> },
  data: { color: "text-purple-700 bg-purple-50 border-purple-200", icon: <Database className="h-2.5 w-2.5" /> },
};

const outcomeStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-slate-600 bg-slate-50 border-slate-200" },
  submitted: { label: "Submitted", color: "text-blue-600 bg-blue-50 border-blue-200" },
  verified: { label: "Verified", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  rejected: { label: "Rejected", color: "text-red-600 bg-red-50 border-red-200" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TaskOutcomeSection({ outcome, viewRole }: { outcome: any; viewRole: ViewRole }) {
  const typeConfig = outcomeTypeBadgeConfig[outcome.type] || outcomeTypeBadgeConfig.information;
  const statusCfg = outcomeStatusConfig[outcome.status] || outcomeStatusConfig.pending;

  // Submit Outcome form state (team)
  const [showSubmitOutcome, setShowSubmitOutcome] = useState(false);
  const [submitOutcomeDesc, setSubmitOutcomeDesc] = useState("");
  const [submitOutcomeType, setSubmitOutcomeType] = useState<string>("code");

  // CEO feedback state
  const [showOutcomeFeedback, setShowOutcomeFeedback] = useState(false);
  const [outcomeFeedbackText, setOutcomeFeedbackText] = useState("");

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">Task Outcome</span>
        <Badge variant="outline" className={`text-[9px] gap-0.5 ${typeConfig.color}`}>
          {typeConfig.icon} {outcome.type}
        </Badge>
        <Badge variant="outline" className={`text-[9px] ml-auto ${statusCfg.color}`}>
          {statusCfg.label}
        </Badge>
      </div>

      <p className="text-[11px] text-gray-700">{outcome.expectedDeliverable}</p>

      {/* Code outcome details */}
      {outcome.type === "code" && (outcome.codeRepoUrl || outcome.codePrUrl || outcome.codeBranch) && (
        <div className="flex items-center gap-3 text-[11px] flex-wrap">
          {outcome.codeRepoUrl && (
            <a href={outcome.codeRepoUrl} className="flex items-center gap-1 text-blue-600 hover:underline">
              <GitBranch className="h-3 w-3" /> Repo
            </a>
          )}
          {outcome.codePrUrl && (
            <a href={outcome.codePrUrl} className="flex items-center gap-1 text-blue-600 hover:underline">
              <GitPullRequest className="h-3 w-3" /> PR
            </a>
          )}
          {outcome.codeBranch && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <GitBranch className="h-3 w-3" /> {outcome.codeBranch}
            </span>
          )}
        </div>
      )}

      {/* Document outcome */}
      {outcome.type === "document" && (outcome.documentTitle || outcome.documentUrl) && (
        <div className="flex items-center gap-2 text-[11px]">
          {outcome.documentTitle && <span className="font-medium">{outcome.documentTitle}</span>}
          {outcome.documentUrl && (
            <a href={outcome.documentUrl} className="flex items-center gap-1 text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3" /> View
            </a>
          )}
        </div>
      )}

      {/* Text outcome */}
      {outcome.textContent && (
        <div className="rounded p-2 bg-white border border-gray-200 text-[11px] text-muted-foreground">
          {outcome.textContent.length > 200 ? outcome.textContent.substring(0, 200) + "..." : outcome.textContent}
        </div>
      )}

      {/* Links */}
      {outcome.links && outcome.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {outcome.links.map((link: any, i: number) => (
            <a key={i} href={link.url} className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
              <LinkIcon className="h-2.5 w-2.5" /> {link.label}
            </a>
          ))}
        </div>
      )}

      {/* Submitted / Verified info */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
        {outcome.submittedBy && (
          <span className="flex items-center gap-1">
            <Avatar userId={outcome.submittedBy} size="sm" />
            Submitted by {getUser(outcome.submittedBy)?.name}
            {outcome.submittedAt && ` \u00b7 ${formatShortDate(outcome.submittedAt)}`}
          </span>
        )}
        {outcome.verifiedBy && (
          <span className="flex items-center gap-1 text-emerald-600">
            <ShieldCheck className="h-3 w-3" />
            Verified by {getUser(outcome.verifiedBy)?.name}
            {outcome.verifiedAt && ` \u00b7 ${formatShortDate(outcome.verifiedAt)}`}
          </span>
        )}
      </div>

      {outcome.feedback && (
        <div className="rounded p-2 bg-amber-50 border border-amber-200 text-[10px]">
          <span className="font-semibold text-amber-700">Feedback: </span>
          <span className="text-amber-800">{outcome.feedback}</span>
        </div>
      )}

      {/* CEO actions */}
      {viewRole === "ceo" && outcome.status === "submitted" && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <Button size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700">
              <ShieldCheck className="h-3 w-3" /> Verify
            </Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="h-3 w-3" /> Reject
            </Button>
            <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => setShowOutcomeFeedback(!showOutcomeFeedback)}
            >
              <MessageSquare className="h-3 w-3" /> Feedback
            </Button>
          </div>
          {showOutcomeFeedback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-2.5 space-y-2">
              <Textarea
                placeholder="Provide feedback on this outcome..."
                className="text-[11px] min-h-[50px] resize-none border-amber-200"
                value={outcomeFeedbackText}
                onChange={e => setOutcomeFeedbackText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" className="text-[10px] h-6 gap-1 bg-amber-600 hover:bg-amber-700">
                  <Send className="h-3 w-3" /> Send Feedback
                </Button>
                <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowOutcomeFeedback(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Team member submit */}
      {viewRole === "team_member" && outcome.status === "pending" && (
        <div className="space-y-2 pt-1">
          {!showSubmitOutcome ? (
            <Button size="sm" className="text-[10px] h-7 gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => setShowSubmitOutcome(true)}>
              <Upload className="h-3 w-3" /> Submit Outcome
            </Button>
          ) : (
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Submit Outcome</span>
                <button onClick={() => setShowSubmitOutcome(false)} className="text-muted-foreground hover:text-gray-700"><X className="h-3 w-3" /></button>
              </div>
              <div>
                <label className="text-[10px] text-blue-600 font-medium">Description</label>
                <Textarea
                  placeholder="Describe your outcome / deliverable..."
                  className="text-[11px] min-h-[50px] resize-none mt-0.5 border-blue-200"
                  value={submitOutcomeDesc}
                  onChange={e => setSubmitOutcomeDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-blue-600 font-medium">Type</label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {(["code", "document", "data", "design", "information", "decision"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setSubmitOutcomeType(t)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                        submitOutcomeType === t
                          ? outcomeTypeBadgeConfig[t]?.color || ""
                          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Type-specific fields */}
              {submitOutcomeType === "code" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Repository URL</label>
                    <Input placeholder="https://github.com/org/repo" className="text-xs h-7 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Pull Request URL</label>
                    <Input placeholder="https://github.com/org/repo/pull/123" className="text-xs h-7 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Branch Name</label>
                    <Input placeholder="feature/my-branch" className="text-xs h-7 mt-0.5" />
                  </div>
                </div>
              )}
              {submitOutcomeType === "document" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Document Link</label>
                    <Input placeholder="https://docs.google.com/..." className="text-xs h-7 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>or</span>
                  </div>
                  <AttachmentBar label="Upload document file" compact />
                </div>
              )}
              {submitOutcomeType === "design" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Design File Link</label>
                    <Input placeholder="https://figma.com/file/..." className="text-xs h-7 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>or</span>
                  </div>
                  <AttachmentBar label="Upload design file" compact />
                </div>
              )}
              {submitOutcomeType === "data" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Data Source / Dashboard URL</label>
                    <Input placeholder="https://..." className="text-xs h-7 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>or</span>
                  </div>
                  <AttachmentBar label="Upload data file (CSV, XLSX, JSON)" compact />
                </div>
              )}
              {(submitOutcomeType === "information" || submitOutcomeType === "decision") && (
                <div>
                  <label className="text-[10px] font-medium text-gray-600">
                    {submitOutcomeType === "decision" ? "Decision Details" : "Information / Findings"}
                  </label>
                  <Textarea
                    placeholder={submitOutcomeType === "decision" ? "Document the decision, rationale, and any alternatives considered..." : "Enter the information, findings, or insights..."}
                    className="text-xs mt-0.5"
                    rows={4}
                  />
                </div>
              )}
              <AttachmentBar label="Attach deliverable or link" />
              <div className="flex gap-2">
                <Button size="sm" className="text-[10px] h-6 gap-1 bg-blue-600 hover:bg-blue-700">
                  <Send className="h-3 w-3" /> Submit
                </Button>
                <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowSubmitOutcome(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── PROJECT OUTCOME & INTERMEDIATE SUBMISSIONS ──────────
// ═══════════════════════════════════════════════════════════

const outcomeTypeLabels: Record<string, string> = {
  product: "Product", web_app: "Web Application", mobile_app: "Mobile App", api_service: "API Service",
  ml_model: "ML Model", data_pipeline: "Data Pipeline", analytics_report: "Analytics Report",
  report: "Report", exploration: "Exploration", market_analysis: "Market Analysis",
  presentation: "Presentation", strategy_document: "Strategy Document", process_document: "Process Document",
  campaign: "Campaign", brand_asset: "Brand Asset", content: "Content",
  ui_design: "UI Design", ux_research: "UX Research", design_system: "Design System",
  tool: "Tool", automation: "Automation", integration: "Integration",
  policy: "Policy", compliance_report: "Compliance Report", other: "Other",
};

const finalOutcomeStatusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_started: { label: "Not Started", color: "text-slate-600 bg-slate-50 border-slate-200", icon: <Circle className="h-3 w-3" /> },
  in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-50 border-blue-200", icon: <Activity className="h-3 w-3 animate-pulse" /> },
  draft_submitted: { label: "Draft Submitted", color: "text-amber-600 bg-amber-50 border-amber-200", icon: <FileUp className="h-3 w-3" /> },
  review: { label: "Under Review", color: "text-purple-600 bg-purple-50 border-purple-200", icon: <Eye className="h-3 w-3" /> },
  finalized: { label: "Finalized", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: <FileCheck className="h-3 w-3" /> },
  delivered: { label: "Delivered", color: "text-emerald-700 bg-emerald-100 border-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const submissionStatusConfig: Record<string, { label: string; color: string }> = {
  submitted: { label: "Submitted", color: "text-blue-600 bg-blue-50 border-blue-200" },
  reviewed: { label: "Reviewed", color: "text-purple-600 bg-purple-50 border-purple-200" },
  approved: { label: "Approved", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  needs_revision: { label: "Needs Revision", color: "text-amber-600 bg-amber-50 border-amber-200" },
};

function ProjectOutcomeSection({ project, subs, viewRole }: { project: Project; subs: Submission[]; viewRole: ViewRole }) {
  const [showSubmitFinal, setShowSubmitFinal] = useState(false);
  const [showAddSubmission, setShowAddSubmission] = useState(false);
  const [newSubType, setNewSubType] = useState<string>("code");

  // Feedback state per submission
  const [showSubFeedback, setShowSubFeedback] = useState<string | null>(null);
  const [subFeedbackText, setSubFeedbackText] = useState("");
  const [showSubFollowUpTask, setShowSubFollowUpTask] = useState<string | null>(null);
  const fo = project.outcome_type ? { expectedType: project.outcome_type, expectedDescription: project.outcome_description } : null;

  return (
    <div className="space-y-4">
      {/* ── Final Outcome Card ── */}
      {fo && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-900">
              <Package className="h-4 w-4 text-indigo-600" />
              Expected Project Outcome
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Expected */}
            <div className="rounded-lg border border-indigo-100 bg-white/70 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Expected Deliverable</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                  {outcomeTypeLabels[fo.expectedType] || fo.expectedType}
                </Badge>
              </div>
              {fo.expectedDescription && <p className="text-xs text-gray-700 leading-relaxed">{fo.expectedDescription}</p>}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {viewRole === "team_member" && (
                <>
                  {!showSubmitFinal ? (
                    <Button size="sm" className="text-[10px] h-7 gap-1" onClick={() => setShowSubmitFinal(true)}>
                      <FileUp className="h-3 w-3" /> Submit Final Deliverable
                    </Button>
                  ) : (
                    <div className="w-full rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Submit Final Deliverable</span>
                        <button onClick={() => setShowSubmitFinal(false)} className="text-muted-foreground hover:text-gray-700">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Input placeholder="Deliverable title" className="text-[11px] h-8" />
                      <Textarea placeholder="Description of the final deliverable..." className="text-[11px] min-h-[60px]" />
                      {/* Type-specific fields based on expected outcome type */}
                      {(["web_app", "mobile_app", "api_service", "tool", "automation", "integration", "ml_model", "data_pipeline"] as string[]).includes(fo.expectedType) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Repository URL</label>
                            <Input placeholder="https://github.com/org/repo" className="text-xs h-7 mt-0.5" />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Deployment / Live URL</label>
                            <Input placeholder="https://app.example.com" className="text-xs h-7 mt-0.5" />
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Documentation Link</label>
                            <Input placeholder="https://docs.example.com" className="text-xs h-7 mt-0.5" />
                          </div>
                        </div>
                      )}
                      {(["report", "strategy_document", "process_document", "policy", "compliance_report"] as string[]).includes(fo.expectedType) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Document Link</label>
                            <Input placeholder="https://docs.google.com/..." className="text-xs h-7 mt-0.5" />
                          </div>
                          <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                          <AttachmentBar label="Upload document file" compact />
                        </div>
                      )}
                      {fo.expectedType === "presentation" && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Presentation Link</label>
                            <Input placeholder="https://docs.google.com/presentation/..." className="text-xs h-7 mt-0.5" />
                          </div>
                          <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                          <AttachmentBar label="Upload presentation file" compact />
                        </div>
                      )}
                      {(["ui_design", "ux_research", "design_system"] as string[]).includes(fo.expectedType) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Design File Link (Figma, Sketch, etc.)</label>
                            <Input placeholder="https://figma.com/file/..." className="text-xs h-7 mt-0.5" />
                          </div>
                          <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                          <AttachmentBar label="Upload design file" compact />
                        </div>
                      )}
                      {(["analytics_report", "market_analysis"] as string[]).includes(fo.expectedType) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Data / Dashboard URL</label>
                            <Input placeholder="https://..." className="text-xs h-7 mt-0.5" />
                          </div>
                          <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                          <AttachmentBar label="Upload data file (CSV, XLSX, JSON)" compact />
                        </div>
                      )}
                      {(["campaign", "brand_asset", "content"] as string[]).includes(fo.expectedType) && (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-gray-600">Content / Asset Link</label>
                            <Input placeholder="https://..." className="text-xs h-7 mt-0.5" />
                          </div>
                          <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                          <AttachmentBar label="Upload content file" compact />
                        </div>
                      )}
                      <AttachmentBar label="Attach final deliverable" />
                      <div className="flex gap-2">
                        <Button size="sm" className="text-[10px] h-7 gap-1">
                          <Send className="h-3 w-3" /> Submit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowSubmitFinal(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Intermediate Submissions Timeline ── */}
      {(subs.length > 0 || viewRole === "team_member") && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Intermediate Submissions
                <Badge variant="secondary" className="text-[10px] ml-1">{subs.length}</Badge>
              </CardTitle>
              {viewRole === "team_member" && (
                <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setShowAddSubmission(!showAddSubmission)}>
                  <Plus className="h-3 w-3" /> Add Submission
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Add submission form (team view) */}
            {showAddSubmission && viewRole === "team_member" && (
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">New Intermediate Submission</span>
                  <button onClick={() => setShowAddSubmission(false)} className="text-muted-foreground hover:text-gray-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <Input placeholder="Submission title (e.g. Draft Report v2)" className="text-[11px] h-8 border-purple-200" />
                <Textarea placeholder="What is this submission about?" className="text-[11px] min-h-[50px] border-purple-200" />
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-purple-600 font-medium">Type:</span>
                  {(["code", "document", "data", "ppt", "text"] as const).map(t => (
                    <Badge key={t} variant="outline" className={`text-[9px] cursor-pointer hover:bg-purple-100 border-purple-200 ${newSubType === t ? "bg-purple-100 ring-1 ring-purple-400" : ""}`} onClick={() => setNewSubType(t)}>
                      {deliverableTypeConfig[t]?.icon}
                      <span className="ml-0.5">{deliverableTypeConfig[t]?.label}</span>
                    </Badge>
                  ))}
                </div>
                {/* Type-specific fields */}
                {newSubType === "code" && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-gray-600">Repository / PR URL</label>
                      <Input placeholder="https://github.com/..." className="text-xs h-7 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-600">Branch</label>
                      <Input placeholder="feature/..." className="text-xs h-7 mt-0.5" />
                    </div>
                  </div>
                )}
                {newSubType === "document" && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-gray-600">Document Link</label>
                      <Input placeholder="https://docs.google.com/..." className="text-xs h-7 mt-0.5" />
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                    <AttachmentBar label="Upload document" compact />
                  </div>
                )}
                {newSubType === "ppt" && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-gray-600">Presentation Link</label>
                      <Input placeholder="https://docs.google.com/presentation/..." className="text-xs h-7 mt-0.5" />
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                    <AttachmentBar label="Upload presentation file" compact />
                  </div>
                )}
                {newSubType === "text" && (
                  <div className="pt-1">
                    <label className="text-[10px] font-medium text-gray-600">Content</label>
                    <Textarea placeholder="Enter the text content, findings, notes..." className="text-xs mt-0.5" rows={5} />
                  </div>
                )}
                {newSubType === "data" && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-medium text-gray-600">Data Link / Dashboard URL</label>
                      <Input placeholder="https://..." className="text-xs h-7 mt-0.5" />
                    </div>
                    <div className="text-[10px] text-gray-400 text-center">&mdash; or &mdash;</div>
                    <AttachmentBar label="Upload data file (CSV, XLSX, JSON)" compact />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="key-milestone" />
                  <label htmlFor="key-milestone" className="text-[10px] text-purple-700 font-medium cursor-pointer">
                    <Star className="h-3 w-3 inline mr-0.5" /> Mark as key milestone
                  </label>
                </div>
                <AttachmentBar label="Attach file" />
                <div className="flex gap-2">
                  <Button size="sm" className="text-[10px] h-7 gap-1 bg-purple-600 hover:bg-purple-700">
                    <Send className="h-3 w-3" /> Submit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowAddSubmission(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {subs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">No intermediate submissions yet</p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-purple-300 via-blue-300 to-emerald-300" />

                <div className="space-y-3">
                  {subs.map((sub, idx) => {
                    const sConfig = submissionStatusConfig[sub.status] || submissionStatusConfig.submitted;
                    const submitter = getUser(sub.user_id);
                    return (
                      <div key={sub.id} className="relative pl-8">
                        {/* Timeline dot */}
                        <div className={`absolute left-1.5 top-3 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm ${
                          sub.status === "approved" ? "bg-emerald-500" :
                          sub.status === "needs_revision" ? "bg-amber-500" :
                          sub.status === "reviewed" ? "bg-purple-500" : "bg-blue-500"
                        }`} />

                        <div className={`rounded-lg border p-3 space-y-2 transition-colors ${
                          sub.is_key_milestone ? "border-amber-200 bg-amber-50/20" : "border-border bg-white"
                        }`}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {sub.is_key_milestone && <Star className="h-3 w-3 text-amber-500 shrink-0 fill-amber-400" />}
                              <span className="text-xs font-semibold truncate">{sub.title}</span>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${deliverableTypeConfig[sub.type]?.color}`}>
                                {deliverableTypeConfig[sub.type]?.icon}
                                <span className="ml-0.5">{deliverableTypeConfig[sub.type]?.label}</span>
                              </Badge>
                            </div>
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${sConfig.color}`}>
                              {sConfig.label}
                            </Badge>
                          </div>

                          {/* Description */}
                          {sub.description && <p className="text-[11px] text-gray-600 leading-relaxed">{sub.description}</p>}

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                            {submitter && (
                              <span className="flex items-center gap-1">
                                <Avatar userId={sub.user_id} size="sm" />
                                {submitter.name} · {formatShortDate(sub.created_at)}
                              </span>
                            )}
                            {sub.link && (
                              <a href={sub.link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-blue-600 hover:text-blue-800 underline">
                                <ExternalLink className="h-2.5 w-2.5" /> Link
                              </a>
                            )}
                          </div>

                          {/* Feedback */}
                          {sub.feedback && sub.feedback.length > 0 && (
                            <div className="rounded border border-blue-200 bg-blue-50/50 p-2 text-[10px]">
                              <span className="font-semibold text-blue-700">Feedback: </span>
                              <span className="text-blue-800">{sub.feedback[0]?.text}</span>
                            </div>
                          )}

                          {/* CEO actions */}
                          {viewRole === "ceo" && sub.status === "submitted" && (
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="text-[10px] h-6 gap-1 bg-emerald-600 hover:bg-emerald-700">
                                  <CheckCircle2 className="h-3 w-3" /> Approve
                                </Button>
                                <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 text-amber-600 border-amber-300 hover:bg-amber-50">
                                  <MessageSquare className="h-3 w-3" /> Request Revision
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => { setShowSubFeedback(showSubFeedback === sub.id ? null : sub.id); setSubFeedbackText(""); }}
                                >
                                  <MessageSquare className="h-3 w-3" /> Add Feedback
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                                  onClick={() => setShowSubFollowUpTask(showSubFollowUpTask === sub.id ? null : sub.id)}
                                >
                                  <ClipboardList className="h-3 w-3" /> Create Follow-up Task
                                </Button>
                              </div>

                              {/* Inline Feedback Form */}
                              {showSubFeedback === sub.id && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-2.5 space-y-2">
                                  <Textarea
                                    placeholder="Provide feedback on this submission..."
                                    className="text-[11px] min-h-[50px] resize-none border-blue-200"
                                    value={subFeedbackText}
                                    onChange={e => setSubFeedbackText(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" className="text-[10px] h-6 gap-1 bg-blue-600 hover:bg-blue-700">
                                      <Send className="h-3 w-3" /> Send Feedback
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setShowSubFeedback(null)}>Cancel</Button>
                                  </div>
                                </div>
                              )}

                              {/* Follow-up Task Form */}
                              {showSubFollowUpTask === sub.id && (
                                <ReviewTaskPanel
                                  onClose={() => setShowSubFollowUpTask(null)}
                                  sourceType="task"
                                  sourceTitle={`Follow-up: ${sub.title}`}
                                  projectId={project.id}
                                  projectTitle={project.title}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ─── MAIN PAGE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // Async data state — all hooks must be declared before any early returns
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [projectSubs, setProjectSubs] = useState<Submission[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      projectsApi.get(id).then(r => r.project),
      projectsApi.tasks(id).then(r => r.tasks),
      usersApi.list().then(r => r.users),
      projectsApi.documents(id).then(r => r.documents).catch(() => [] as ProjectDocument[]),
      projectsApi.checkpoints(id).then(r => r.checkpoints).catch(() => [] as Checkpoint[]),
      submissionsApi.list({ project_id: id }).then(r => r.submissions).catch(() => [] as Submission[]),
    ]).then(([proj, t, users, docs, cps, subs]) => {
      setProject(proj);
      setTasks(t);
      _userMap = Object.fromEntries(users.map(u => [u.id, u]));
      setDocuments(docs);
      setCheckpoints(cps);
      setProjectSubs(subs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const [viewRole, setViewRole] = useState<ViewRole>("ceo");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [, forceUpdate] = useState(0);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showAddPhaseForm, setShowAddPhaseForm] = useState(false);
  const [aiSuggestedPhases, setAiSuggestedPhases] = useState<{ name: string; description: string; estimatedDuration: string; checklist: { item: string; done: boolean }[] }[] | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);

  // Add Task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskStatus, setNewTaskStatus] = useState<"planning" | "in_progress">("planning");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newTaskHours, setNewTaskHours] = useState<number>(0);
  const [newTaskOutcomeType, setNewTaskOutcomeType] = useState<OutcomeType>("information");
  const [newTaskDeliverable, setNewTaskDeliverable] = useState("");
  const [newTaskPhaseId, setNewTaskPhaseId] = useState<string>("");
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Add Phase form state
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDesc, setNewPhaseDesc] = useState("");
  const [newPhaseDuration, setNewPhaseDuration] = useState("");
  const [newPhaseChecklist, setNewPhaseChecklist] = useState<{ item: string; done: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newPhaseStartDate, setNewPhaseStartDate] = useState("");
  const [newPhaseEndDate, setNewPhaseEndDate] = useState("");

  // Edit Phase form state
  const [editPhaseName, setEditPhaseName] = useState("");
  const [editPhaseDesc, setEditPhaseDesc] = useState("");
  const [editPhaseDuration, setEditPhaseDuration] = useState("");
  const [editPhaseStartDate, setEditPhaseStartDate] = useState("");
  const [editPhaseEndDate, setEditPhaseEndDate] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Project Not Found</h2>
          <p className="text-muted-foreground">The project you&apos;re looking for doesn&apos;t exist.</p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const phases = project.phases ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
  const blockedTasks = tasks.filter(t => t.status === "blocked").length;
  const startDate = project.start_date ?? project.created_at;
  const daysLeft = differenceInDays(addDays(new Date(startDate), project.timebox_days), new Date());
  const isOverdue = daysLeft < 0;
  const allExtensions = tasks.flatMap(t => t.deadline_extensions ?? []);
  const pendingExtensions = allExtensions.filter(de => de.status === "pending");
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const coOwnerIds = project.co_owners?.map(u => u.id) || [];
  const assigneeIds = project.assignees?.map(u => u.id) || [];

  const TABS = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "documents", label: "Documents", icon: <BookOpen className="h-3.5 w-3.5" />, count: documents.length },
    { id: "phases", label: "Phases & Tasks", icon: <GitBranch className="h-3.5 w-3.5" />, count: phases.length },
    { id: "tasks", label: "All Tasks", icon: <Layers className="h-3.5 w-3.5" />, count: totalTasks },
    { id: "results", label: "Results & Reviews", icon: <Trophy className="h-3.5 w-3.5" /> },
  ];

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    tasksApi.create({
      project_id: project.id,
      title: newTaskTitle,
      description: newTaskDesc || undefined,
      priority: newTaskPriority,
      assignee_id: newTaskAssignees[0] || undefined,
      estimated_hours: newTaskHours || undefined,
      phase_id: newTaskPhaseId || undefined,
    }).then(() => projectsApi.tasks(id).then(r => setTasks(r.tasks))).catch(() => {});
    setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskPriority("medium"); setNewTaskStatus("planning");
    setNewTaskAssignees([]); setNewTaskHours(0); setNewTaskOutcomeType("information"); setNewTaskDeliverable("");
    setNewTaskPhaseId(""); setNewTaskStartDate(""); setNewTaskDueDate("");
    setShowAddTaskForm(false);
  };

  const handleAddPhase = () => {
    if (!newPhaseName.trim()) return;
    phasesApi.create({
      project_id: project.id,
      phase_name: newPhaseName,
      description: newPhaseDesc || undefined,
      checklist: newPhaseChecklist,
    }).then(() => projectsApi.get(id).then(r => setProject(r.project))).catch(() => {});
    setNewPhaseName(""); setNewPhaseDesc(""); setNewPhaseDuration(""); setNewPhaseChecklist([]); setNewChecklistItem("");
    setNewPhaseStartDate(""); setNewPhaseEndDate("");
    setShowAddPhaseForm(false);
  };

  const handleApplyAIPhases = () => {
    if (!aiSuggestedPhases) return;
    Promise.all(aiSuggestedPhases.map(p =>
      phasesApi.create({ project_id: project.id, phase_name: p.name, description: p.description, checklist: p.checklist })
    )).then(() => projectsApi.get(id).then(r => setProject(r.project))).catch(() => {});
    setAiSuggestedPhases(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Back + Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <a
            href={`/projects/${project.id}/kanban`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <Kanban className="h-3.5 w-3.5" /> Kanban Board
          </a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={
                ({
                  engineering: "text-blue-700 bg-blue-50 border-blue-200",
                  research: "text-purple-700 bg-purple-50 border-purple-200",
                  mixed: "text-teal-700 bg-teal-50 border-teal-200",
                  data_science: "text-violet-700 bg-violet-50 border-violet-200",
                  design: "text-pink-700 bg-pink-50 border-pink-200",
                  sales: "text-orange-700 bg-orange-50 border-orange-200",
                  marketing: "text-rose-700 bg-rose-50 border-rose-200",
                  operations: "text-slate-700 bg-slate-50 border-slate-200",
                  hr: "text-cyan-700 bg-cyan-50 border-cyan-200",
                  legal: "text-gray-700 bg-gray-50 border-gray-200",
                  strategy: "text-indigo-700 bg-indigo-50 border-indigo-200",
                  product: "text-emerald-700 bg-emerald-50 border-emerald-200",
                  finance: "text-amber-700 bg-amber-50 border-amber-200",
                } as Record<string, string>)[project.type] || "text-gray-700 bg-gray-50 border-gray-200"
              }>
                {({
                  engineering: "Engineering", research: "Research / DS", mixed: "Mixed",
                  data_science: "Data Science", design: "Design", sales: "Sales",
                  marketing: "Marketing", operations: "Operations", hr: "HR",
                  legal: "Legal", strategy: "Strategy", product: "Product", finance: "Finance",
                } as Record<string, string>)[project.type] || project.type}
              </Badge>
              <Badge variant="outline" className={statusColors[project.status]}>
                {project.status}
              </Badge>
              <div className={`h-2.5 w-2.5 rounded-full ${
                project.priority === "high" || project.priority === "critical" ? "bg-red-500" :
                project.priority === "medium" ? "bg-amber-400" : "bg-slate-400"
              }`} />
            </div>
          </div>

          {/* View Role Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setViewRole("ceo")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                viewRole === "ceo"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-gray-100"
              }`}
            >
              <Eye className="h-3 w-3" /> CEO View
            </button>
            <button
              onClick={() => setViewRole("team_member")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                viewRole === "team_member"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-gray-100"
              }`}
            >
              <Settings className="h-3 w-3" /> Team View
            </button>
          </div>
        </div>
      </div>

      {/* ── Pending Extensions Banner ── */}
      {pendingExtensions.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{pendingExtensions.length} deadline extension{pendingExtensions.length > 1 ? "s" : ""} awaiting your decision</p>
            <p className="text-[11px] text-amber-600">Scroll to the relevant task below to approve or reject</p>
          </div>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-white/20" : "bg-gray-200 text-gray-700"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── TAB: OVERVIEW ──────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                <Target className="h-3.5 w-3.5" /> Task Progress
              </div>
              <p className="text-2xl font-bold">{taskProgress}%</p>
              <Progress value={taskProgress} className="h-1 mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">{completedTasks}/{totalTasks} completed</p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                <Clock className="h-3.5 w-3.5" /> Time Remaining
              </div>
              <p className={`text-2xl font-bold ${isOverdue ? "text-red-600" : ""}`}>
                {isOverdue ? `${Math.abs(daysLeft)}d over` : `${daysLeft} days`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{project.timebox_days}-day timebox · Started {formatShortDate(project.start_date ?? project.created_at)}</p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                <Users className="h-3.5 w-3.5" /> Team
              </div>
              <div className="space-y-1.5 mt-1">
                {(() => {
                  const owner = getUser(project.owner_id);
                  return owner ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar userId={project.owner_id} size="sm" />
                      <span className="text-xs font-medium">{owner.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Owner</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">{owner.department}</span>
                    </div>
                  ) : null;
                })()}
                {coOwnerIds && coOwnerIds.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {coOwnerIds.map(cid => {
                      const co = getUser(cid);
                      return co ? (
                        <div key={cid} className="flex items-center gap-1">
                          <Avatar userId={cid} size="sm" />
                          <span className="text-xs">{co.name}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Co-owner</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">{co.department}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
                {(() => {
                  const ownerAndCoOwners = [project.owner_id, ...(coOwnerIds || [])];
                  const others = assigneeIds.filter(id => !ownerAndCoOwners.includes(id));
                  return others.length > 0 ? (
                    <div className="flex -space-x-1.5">
                      {others.map(uid => {
                        const u = getUser(uid);
                        return u ? (
                          <div key={uid} title={`${u.name} (${u.department})`}>
                            <Avatar userId={uid} size="sm" />
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : null;
                })()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">{assigneeIds.length} members</p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                <Activity className="h-3.5 w-3.5" /> Status
              </div>
              <div className="space-y-1 mt-1">
                {inProgressTasks > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>{inProgressTasks} in progress</span>
                  </div>
                )}
                {blockedTasks > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-red-600">{blockedTasks} blocked</span>
                  </div>
                )}
                {pendingExtensions.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-amber-600">{pendingExtensions.length} extensions</span>
                  </div>
                )}
                {blockedTasks === 0 && pendingExtensions.length === 0 && inProgressTasks === 0 && (
                  <p className="text-xs text-muted-foreground">All clear</p>
                )}
              </div>
            </Card>
          </div>

          {/* ── Tech Stack ── */}
          {(project.tech_stack ?? []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Tech Stack:</span>
              {(project.tech_stack ?? []).map(tech => (
                <Badge key={tech} variant="secondary" className="text-[10px]">{tech}</Badge>
              ))}
            </div>
          )}

          {/* ── AI Plan & Risk Analysis ── */}
          {project.ai_plan && (
            <AIPlanSection aiPlan={project.ai_plan} viewRole={viewRole} />
          )}

          {/* ── Checkpoints ── */}
          {checkpoints.length > 0 && (
            <CheckpointsSection checkpoints={checkpoints} viewRole={viewRole} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── TAB: DOCUMENTS ─────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">
              Documents can be refined at any point during the project. Add new documents, update sections, propose changes, and track discussions — all changes are versioned and linked to tasks.
            </p>
          </div>

          {documents.length > 0 ? (
            <ProjectDocumentsSection documents={documents} viewRole={viewRole} tasks={tasks} projectId={project.id} onUpdate={() => forceUpdate(prev => prev + 1)} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No documents yet</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── TAB: TASKS & MILESTONES ────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Tasks ({totalTasks})
            </h2>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddTaskForm(!showAddTaskForm)}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          </div>

          {/* ── Add Task Form ── */}
          {showAddTaskForm && (
            <Card className="p-4 border-blue-200 bg-blue-50/20">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /> New Task</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Phase <span className="text-red-400">*</span></label>
                  <div className="flex gap-1.5 flex-wrap">
                    {phases.map(ph => (
                      <button key={ph.id} onClick={() => setNewTaskPhaseId(ph.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${newTaskPhaseId === ph.id ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {ph.order_index + 1}. {ph.phase_name}
                      </button>
                    ))}
                  </div>
                  {phases.length === 0 && <p className="text-[10px] text-amber-600 mt-1">No phases defined. Go to &quot;Phases &amp; Tasks&quot; tab to create phases first.</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
                  <Input placeholder="Task title" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                  <Textarea placeholder="Task description..." value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="text-sm" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
                    <div className="flex gap-1.5">
                      {(["low", "medium", "high"] as const).map(p => (
                        <button key={p} onClick={() => setNewTaskPriority(p)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${newTaskPriority === p ? (p === "high" ? "bg-red-500 text-white" : p === "medium" ? "bg-amber-400 text-white" : "bg-slate-400 text-white") : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                    <div className="flex gap-1.5">
                      {(["planning", "in_progress"] as const).map(s => (
                        <button key={s} onClick={() => setNewTaskStatus(s)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${newTaskStatus === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Assignees</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(_userMap).map(u => (
                      <label key={u.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox checked={newTaskAssignees.includes(u.id)} onCheckedChange={(checked) => {
                          if (checked) setNewTaskAssignees(prev => [...prev, u.id]);
                          else setNewTaskAssignees(prev => prev.filter(id => id !== u.id));
                        }} />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Estimated Hours</label>
                  <Input type="number" placeholder="0" value={newTaskHours || ""} onChange={e => setNewTaskHours(Number(e.target.value))} className="text-sm w-32" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date</label>
                    <Input type="date" value={newTaskStartDate} onChange={e => setNewTaskStartDate(e.target.value)} className="text-xs h-8" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Due Date</label>
                    <Input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="text-xs h-8" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Expected Outcome Type</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["information", "decision", "document", "code", "design", "data"] as OutcomeType[]).map(ot => (
                      <button key={ot} onClick={() => setNewTaskOutcomeType(ot)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${newTaskOutcomeType === ot ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {ot}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Expected Deliverable</label>
                  <Input placeholder="What should this task produce?" value={newTaskDeliverable} onChange={e => setNewTaskDeliverable(e.target.value)} className="text-sm" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save Task
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddTaskForm(false)} className="text-xs">Cancel</Button>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} projectId={project.id} projectTitle={project.title} viewRole={viewRole} onReviewUpdate={() => forceUpdate(prev => prev + 1)} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── TAB: PHASES ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "phases" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Phases ({phases.length})
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                const suggestions = generateAIPhases(project.type, project.title);
                setAiSuggestedPhases(suggestions);
              }}>
                <Sparkles className="h-3.5 w-3.5" /> AI Suggest Phases
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowAddPhaseForm(!showAddPhaseForm)}>
                <Plus className="h-3.5 w-3.5" /> Add Phase
              </Button>
            </div>
          </div>

          {/* ── AI Suggested Phases Preview ── */}
          {aiSuggestedPhases && (
            <Card className="p-4 border-purple-200 bg-purple-50/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" /> AI-Suggested Phases</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleApplyAIPhases} className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Apply All
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAiSuggestedPhases(null)} className="text-xs">Dismiss</Button>
                </div>
              </div>
              <div className="space-y-2">
                {aiSuggestedPhases.map((phase, idx) => (
                  <div key={idx} className="rounded-lg border border-purple-100 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-100 rounded-full h-5 w-5 flex items-center justify-center">{idx + 1}</span>
                      <span className="text-sm font-medium">{phase.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{phase.estimatedDuration}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-7">{phase.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Add Phase Form ── */}
          {showAddPhaseForm && (
            <Card className="p-4 border-blue-200 bg-blue-50/20">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Plus className="h-4 w-4" /> New Phase</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                  <Input placeholder="Phase name" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                  <Textarea placeholder="Phase description..." value={newPhaseDesc} onChange={e => setNewPhaseDesc(e.target.value)} className="text-sm" rows={2} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Estimated Duration</label>
                  <Input placeholder="e.g., 1-2 weeks" value={newPhaseDuration} onChange={e => setNewPhaseDuration(e.target.value)} className="text-sm w-48" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">Start Date</label>
                    <Input type="date" value={newPhaseStartDate} onChange={e => setNewPhaseStartDate(e.target.value)} className="text-xs h-7 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-600">End Date</label>
                    <Input type="date" value={newPhaseEndDate} onChange={e => setNewPhaseEndDate(e.target.value)} className="text-xs h-7 mt-0.5" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Checklist Items</label>
                  <div className="space-y-1.5">
                    {newPhaseChecklist.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-gray-400" />
                        <span className="flex-1">{item.item}</span>
                        <button onClick={() => setNewPhaseChecklist(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <div className="flex gap-1.5">
                      <Input placeholder="Add checklist item..." value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} className="text-xs flex-1" onKeyDown={e => {
                        if (e.key === "Enter" && newChecklistItem.trim()) {
                          setNewPhaseChecklist(prev => [...prev, { item: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem("");
                        }
                      }} />
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                        if (newChecklistItem.trim()) {
                          setNewPhaseChecklist(prev => [...prev, { item: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem("");
                        }
                      }}>Add</Button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleAddPhase} disabled={!newPhaseName.trim()} className="gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Save Phase
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddPhaseForm(false)} className="text-xs">Cancel</Button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Phase List with Edit/Remove ── */}
          {phases.length > 0 ? (
            <div className="space-y-3">
              {phases.map((phase, idx) => (
                <div key={phase.id}>
                <Card className="p-3">
                  {editingPhaseId === phase.id ? (
                    <div className="space-y-3">
                      <Input value={editPhaseName} onChange={e => setEditPhaseName(e.target.value)} className="text-sm font-medium" />
                      <Textarea value={editPhaseDesc} onChange={e => setEditPhaseDesc(e.target.value)} className="text-xs" rows={2} />
                      <Input value={editPhaseDuration} onChange={e => setEditPhaseDuration(e.target.value)} className="text-xs w-48" placeholder="Duration" />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-gray-600">Start Date</label>
                          <Input type="date" value={editPhaseStartDate} onChange={e => setEditPhaseStartDate(e.target.value)} className="text-xs h-7 mt-0.5" />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-gray-600">End Date</label>
                          <Input type="date" value={editPhaseEndDate} onChange={e => setEditPhaseEndDate(e.target.value)} className="text-xs h-7 mt-0.5" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={() => {
                          updatePhase(project.id, phase.id, { name: editPhaseName, description: editPhaseDesc, estimatedDuration: editPhaseDuration, startDate: editPhaseStartDate || undefined, endDate: editPhaseEndDate || undefined });
                          setEditingPhaseId(null);
                          forceUpdate(prev => prev + 1);
                        }}>Save</Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditingPhaseId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{phase.phase_name}</span>
                          <Badge variant="outline" className={`text-[10px] ${
                            phase.status === "completed" ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
                            phase.status === "active" ? "text-blue-700 bg-blue-50 border-blue-200" :
                            "text-gray-600 bg-gray-50 border-gray-200"
                          }`}>{phase.status}</Badge>
                          {phase.estimated_duration && <span className="text-[10px] text-muted-foreground">{phase.estimated_duration}</span>}
                          {phase.start_date && phase.end_date && (
                            <span className="text-[10px] text-gray-500">
                              {formatShortDate(phase.start_date)} → {formatShortDate(phase.end_date)}
                            </span>
                          )}
                        </div>
                        {phase.description && <p className="text-xs text-muted-foreground mt-1">{phase.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingPhaseId(phase.id); setEditPhaseName(phase.phase_name); setEditPhaseDesc(phase.description || ""); setEditPhaseDuration(phase.estimated_duration || ""); setEditPhaseStartDate(phase.start_date || ""); setEditPhaseEndDate(phase.end_date || ""); }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { removePhase(project.id, phase.id); forceUpdate(prev => prev + 1); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
                {/* Tasks in this phase */}
                {(() => {
                  const phaseTasks = tasks.filter(t => t.phase_id === phase.id);
                  if (phaseTasks.length === 0) return (
                    <div className="ml-8 mb-3 mt-1 px-3 py-2 rounded border border-dashed border-gray-200 text-xs text-gray-400 flex items-center gap-1.5">
                      <Layers className="h-3 w-3" /> No tasks defined for this phase yet
                      <button onClick={() => { setNewTaskPhaseId(phase.id); setShowAddTaskForm(true); setActiveTab("tasks"); }} className="text-blue-600 hover:underline ml-1">+ Add task</button>
                    </div>
                  );
                  return (
                    <div className="ml-8 mb-3 mt-1 space-y-1.5">
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{phaseTasks.length} Task{phaseTasks.length > 1 ? "s" : ""} in this phase</p>
                      {phaseTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setActiveTab("tasks")}>
                          <div className={`h-2 w-2 rounded-full shrink-0 ${task.status === "completed" ? "bg-emerald-500" : task.status === "in_progress" ? "bg-blue-500" : task.status === "blocked" ? "bg-red-500" : "bg-gray-300"}`} />
                          <span className="text-xs font-medium flex-1 truncate">{task.title}</span>
                          <Badge variant="outline" className={`text-[9px] ${statusColors[task.status]}`}>{task.status.replace("_", " ")}</Badge>
                          {task.assignee_id && <Avatar userId={task.assignee_id} size="sm" />}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No phases defined yet. Add phases or let AI suggest them.</p>
            </div>
          )}

          {/* ── Full PhasesTimelineSection below ── */}
          {phases.length > 0 && (
            <PhasesTimelineSection phases={phases} viewRole={viewRole} projectId={project.id} />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── TAB: RESULTS & REVIEWS ─────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      {activeTab === "results" && (
        <div className="space-y-6">
          <ProjectOutcomeSection project={project} subs={projectSubs} viewRole={viewRole} />
        </div>
      )}
    </div>
  );
}
