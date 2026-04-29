"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { projects as projectsApi, ai as aiApi, type User, type AiPlan } from "@/lib/api-client";

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  data_science: "Data Science",
  design: "Design",
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  hr: "HR",
  legal: "Legal",
  strategy: "Strategy",
  research: "Research",
  product: "Product",
  finance: "Finance",
  mixed: "Mixed / Cross-functional",
};

const OUTCOME_OPTIONS: Record<string, string[]> = {
  engineering: ["product", "web_app", "mobile_app", "api_service", "tool", "integration"],
  data_science: ["ml_model", "data_pipeline", "report", "analytics_report"],
  design: ["ui_design", "design_system", "ux_research"],
  marketing: ["campaign", "content", "brand_asset"],
  research: ["report", "exploration", "market_analysis"],
};

const OUTCOME_FALLBACK: string[] = ["report", "other", "presentation"];

function outcomeLabel(ot: string): string {
  return ot
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function NewProjectClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("engineering");
  const [outcomeType, setOutcomeType] = useState<string>("product");
  const [requirement, setRequirement] = useState("");
  const [priority, setPriority] = useState("medium");
  const [timeboxDays, setTimeboxDays] = useState(14);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [coOwnerIds, setCoOwnerIds] = useState<string[]>([]);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<"details" | "plan" | "review">("details");

  async function generatePlan() {
    setGenerating(true);
    try {
      const result = await aiApi.generatePlan({ requirement, project_type: type, timebox_days: timeboxDays });
      setAiPlan(result.plan);
      setStep("plan");
    } catch {
      showToast.error("Plan generation failed", "Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function createProject() {
    setCreating(true);
    try {
      const resolvedOwner = ownerId || selectedUsers[0] || "";
      const resolvedCoOwners = coOwnerIds.filter((id) => id !== resolvedOwner);
      const result = await projectsApi.create({
        title,
        type,
        requirement,
        priority,
        owner_id: resolvedOwner,
        assignee_ids: selectedUsers.length > 0 ? selectedUsers : undefined,
        co_owner_ids: resolvedCoOwners.length > 0 ? resolvedCoOwners : undefined,
        timebox_days: timeboxDays,
        start_date: new Date().toISOString().split("T")[0],
        tech_stack: aiPlan?.techStack || [],
        ai_plan: aiPlan ? { summary: aiPlan.summary, risks: aiPlan.risks, killCriteria: aiPlan.killCriteria } : undefined,
      });
      showToast.success("Project created!", "Redirecting to your new project…");
      router.push(`/projects/${result.project.id}`);
    } catch {
      showToast.error("Failed to create project", "Please check your inputs and try again.");
    } finally {
      setCreating(false);
    }
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  const severityColors: Record<string, string> = {
    low: "text-green-400",
    medium: "text-amber-400",
    high: "text-red-400",
  };

  const steps = ["details", "plan", "review"] as const;
  const stepLabels = { details: "Define", plan: "AI Plan", review: "Review" };
  const stepDescs  = { details: "Project details", plan: "Generated plan", review: "Confirm & create" };

  return (
    <div className="max-w-4xl space-y-5 sm:space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="animate-fade-in-up">
        <h1 className="text-display text-slate-900">New Project</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Define your project and let AI help you plan it
        </p>
      </div>

      {/* ── Step indicator ─────────────────────────────────── */}
      <div
        className="bg-white rounded-2xl border shadow-card p-4 animate-fade-in-up stagger-1"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center">
          {steps.map((s, i) => {
            const currentIdx = steps.indexOf(step);
            const isDone   = i < currentIdx;
            const isActive = s === step;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "btn-gradient text-white shadow-glow-blue"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4.5 w-4.5" /> : i + 1}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-sm font-semibold ${isActive ? "text-gray-900" : isDone ? "text-emerald-600" : "text-gray-400"}`}>
                      {stepLabels[s]}
                    </p>
                    <p className="text-[10px] text-gray-400">{stepDescs[s]}</p>
                  </div>
                </div>
                {i < 2 && (
                  <div className="flex-1 mx-4 h-px" style={{
                    background: i < steps.indexOf(step)
                      ? "linear-gradient(90deg, #22c55e, #22c55e)"
                      : "rgba(0,0,0,0.08)",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Details */}
      {step === "details" && (
        <div className="bg-white rounded-2xl border shadow-card animate-fade-in-up stagger-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <h2 className="font-bold text-gray-900">Project Details</h2>
            <p className="text-sm text-gray-400 mt-0.5">Describe your project requirement in plain English</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Customer Churn Prediction System"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    if (!v) return;
                    setType(v);
                    const options = OUTCOME_OPTIONS[v] || OUTCOME_FALLBACK;
                    if (!options.includes(outcomeType)) {
                      setOutcomeType(options[0]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CATEGORY_LABELS).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Outcome Type</Label>
              <div className="flex flex-wrap gap-2">
                {(OUTCOME_OPTIONS[type] || OUTCOME_FALLBACK).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOutcomeType(ot)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      outcomeType === ot
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {outcomeLabel(ot)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timebox">Timebox (days)</Label>
              <Input
                id="timebox"
                type="number"
                min={1}
                max={365}
                value={timeboxDays}
                onChange={(e) => setTimeboxDays(parseInt(e.target.value) || 14)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirement">Requirement</Label>
              <Textarea
                id="requirement"
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="Describe what you need built or researched in plain English..."
                className="min-h-[120px] rounded-xl border-gray-200 bg-gray-50 focus:bg-white transition-colors resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Assign Team Members</Label>
              <div className="space-y-2">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: user.avatar_color }}
                    >
                      {user.name[0]}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {user.role_type}
                      </span>
                    </div>
                  </label>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No team members yet. Add them in the Team section.
                  </p>
                )}
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select
                    value={ownerId || selectedUsers[0]}
                    onValueChange={(v) => {
                      if (!v) return;
                      setOwnerId(v);
                      setCoOwnerIds((prev) => prev.filter((id) => id !== v));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => selectedUsers.includes(u.id))
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Co-owner(s)</Label>
                  <div className="space-y-1">
                    {users
                      .filter(
                        (u) =>
                          selectedUsers.includes(u.id) &&
                          u.id !== (ownerId || selectedUsers[0])
                      )
                      .map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={coOwnerIds.includes(u.id)}
                            onCheckedChange={() =>
                              setCoOwnerIds((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((id) => id !== u.id)
                                  : [...prev, u.id]
                              )
                            }
                          />
                          <span className="text-sm">{u.name}</span>
                        </label>
                      ))}
                    {users.filter(
                      (u) =>
                        selectedUsers.includes(u.id) &&
                        u.id !== (ownerId || selectedUsers[0])
                    ).length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Select more team members to assign co-owners.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={generatePlan}
                disabled={!title || !requirement || generating}
                className="gap-2 btn-gradient text-white border-0 shadow-glow-blue rounded-xl disabled:opacity-50 disabled:shadow-none disabled:transform-none"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? "Generating…" : "Generate AI Plan"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setAiPlan(null); setStep("review"); }}
                disabled={!title || !requirement}
                className="rounded-xl border-gray-200"
              >
                Skip AI Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: AI Plan Review */}
      {step === "plan" && aiPlan && (
        <div className="space-y-4 animate-fade-in-up stagger-2">
          <div className="bg-white rounded-2xl border shadow-card overflow-hidden" style={{ borderColor: "rgba(59,130,246,0.12)" }}>
            {/* AI plan header band */}
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #6366f1)" }} />
            <div className="px-6 py-5 border-b flex items-start gap-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">AI-Generated Plan</h2>
                <p className="text-sm text-gray-500 mt-0.5">{aiPlan.summary}</p>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Tech Stack */}
              {aiPlan.techStack && aiPlan.techStack.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Suggested Tech Stack
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {aiPlan.techStack.map((tech) => (
                      <Badge key={tech} variant="secondary">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}


              {/* Risks */}
              {aiPlan.risks && aiPlan.risks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Risk Assessment
                  </h4>
                  <div className="space-y-2">
                    {aiPlan.risks.map((r, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-accent/50 space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className={`h-3.5 w-3.5 ${severityColors[r.severity]}`}
                          />
                          <span className="text-sm font-medium">{r.risk}</span>
                          <Badge variant="outline" className="text-xs">
                            {r.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5">
                          Mitigation: {r.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kill Criteria */}
              {aiPlan.killCriteria && aiPlan.killCriteria.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Kill Criteria</h4>
                  <ul className="space-y-1">
                    {aiPlan.killCriteria.map((k, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setStep("details")} variant="outline" className="rounded-xl border-gray-200">
              Back to Details
            </Button>
            <Button
              onClick={() => setStep("review")}
              className="btn-gradient text-white border-0 shadow-glow-blue rounded-xl"
            >
              Approve Plan
            </Button>
            <Button
              variant="outline"
              onClick={generatePlan}
              disabled={generating}
              className="gap-2 rounded-xl border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Final Review & Create */}
      {step === "review" && (
        <div className="bg-white rounded-2xl border shadow-card animate-fade-in-up stagger-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <h2 className="font-bold text-gray-900">Review & Create</h2>
            <p className="text-sm text-gray-400 mt-0.5">Confirm project details before creation</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Title:</span>
                <p className="font-medium">{title}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium">{CATEGORY_LABELS[type]}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outcome Type:</span>
                <p className="font-medium">{outcomeLabel(outcomeType)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>
                <p className="font-medium capitalize">{priority}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Timebox:</span>
                <p className="font-medium">{timeboxDays} days</p>
              </div>
              {(ownerId || selectedUsers.length > 0) && (
                <div>
                  <span className="text-muted-foreground">Owner:</span>
                  <p className="font-medium">
                    {users.find(
                      (u) => u.id === (ownerId || selectedUsers[0])
                    )?.name || "—"}
                  </p>
                </div>
              )}
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Requirement:</span>
              <p className="mt-1">{requirement}</p>
            </div>
            {selectedUsers.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Team:</span>
                <div className="flex gap-2 mt-1">
                  {users
                    .filter((u) => selectedUsers.includes(u.id))
                    .map((u) => (
                      <Badge key={u.id} variant="secondary">
                        {u.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
            {coOwnerIds.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Co-owner(s):</span>
                <div className="flex gap-2 mt-1">
                  {users
                    .filter((u) => coOwnerIds.includes(u.id))
                    .map((u) => (
                      <Badge key={u.id} variant="outline">
                        {u.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
            {aiPlan && (
              <div className="text-sm">
                <span className="text-muted-foreground">AI Plan:</span>
                <p className="mt-1 text-green-400">Approved</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(aiPlan ? "plan" : "details")}
                className="rounded-xl border-gray-200"
              >
                Back
              </Button>
              <Button
                onClick={createProject}
                disabled={creating}
                className="gap-2 btn-gradient text-white border-0 shadow-glow-blue rounded-xl disabled:opacity-60 disabled:shadow-none disabled:transform-none"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {creating ? "Creating…" : "Create Project"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
