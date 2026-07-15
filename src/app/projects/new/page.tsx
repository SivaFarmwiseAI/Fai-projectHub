"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Pencil,
  Rocket,
  Upload,
  FileText,
  Target,
  ListChecks,
  PackageCheck,
  Plus,
  Trash2,
  Check,
  Layers,
} from "lucide-react";
import {
  projects as projectsApi,
  uploads as uploadsApi,
  ai as aiApi,
  users as usersApi,
  auth as authApi,
  ApiError,
  type User,
  type AiPlan,
} from "@/lib/api-client";

const STEPS = ["Define", "AI Plan", "Review"];

const OUTCOME_TYPES = [
  { value: "product",     label: "Product",              description: "Building a new product or feature from scratch",     icon: "🚀" },
  { value: "enhancement", label: "Enhancement",           description: "Adding capabilities to an existing product",         icon: "⚡" },
  { value: "capability",  label: "Capability Build",      description: "Building internal tooling or infrastructure",        icon: "🔧" },
  { value: "delivery",    label: "Delivery Project",      description: "Client deliverable with fixed scope & timeline",     icon: "📦" },
  { value: "research",    label: "Research / Exploration",description: "Investigating feasibility or new approaches",        icon: "🔬" },
  { value: "migration",   label: "Migration",             description: "Moving from one system/platform to another",        icon: "🔄" },
];

const STANDARD_PHASES = [
  { name: "Requirement Understanding",       description: "Team reads the requirement, asks clarifications, discusses scope. Finalize requirement document with MOM.", estimatedDuration: "2-3 days", deliverables: ["Finalized requirement document", "Clarification MOM", "Team sign-off"] },
  { name: "Design & Architecture Freeze",    description: "Architecture design, tech stack decisions, API contracts. Design review meeting. Freeze design before proceeding.", estimatedDuration: "3-5 days", deliverables: ["Architecture document", "Design review MOM", "Design freeze sign-off"] },
  { name: "Prototype / PoC Build",           description: "Build a minimal working prototype to validate the approach. Demo to CEO for approval before full development.", estimatedDuration: "3-5 days", deliverables: ["Working prototype", "Demo recording or live demo", "CEO approval"] },
  { name: "Development",                     description: "Full implementation with regular status updates. Code reviews, unit tests, integration tests.", estimatedDuration: "1-2 weeks", deliverables: ["Working code with tests", "Code review approvals", "Status update docs"] },
  { name: "Testing & Review",                description: "End-to-end testing, performance testing, security review. Fix all issues found.", estimatedDuration: "3-5 days", deliverables: ["Test report", "Performance benchmarks", "Security review doc"] },
  { name: "Deployment & Handoff",            description: "Deploy to production, documentation, knowledge transfer, monitoring setup.", estimatedDuration: "2-3 days", deliverables: ["Deployment proof", "Documentation", "Monitoring dashboards"] },
];

const STANDARD_MILESTONES = [
  { title: "Requirements Finalized", description: "All clarifications resolved, requirement document signed off by team", targetDay: 3 },
  { title: "Design Frozen",          description: "Architecture and tech stack locked, design document approved",         targetDay: 7 },
  { title: "Prototype Approved",     description: "Working PoC demonstrated and approved by CEO",                        targetDay: 11 },
  { title: "Core Features Complete", description: "Main implementation done with passing tests",                         targetDay: 17 },
  { title: "Production Ready",       description: "All tests passing, reviewed, deployed to staging",                    targetDay: 21 },
];

interface AiPlanFull extends AiPlan {
  phases: typeof STANDARD_PHASES;
  milestones: typeof STANDARD_MILESTONES;
}

// "YYYY-MM-DDTHH:mm" in local time — format expected by <input type="datetime-local">
function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDaysToDate(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// Whole days between two datetime-local strings, minimum 1 if both set
function diffDays(fromLocal: string, toLocal: string): number {
  if (!fromLocal || !toLocal) return 0;
  const ms = new Date(toLocal).getTime() - new Date(fromLocal).getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiPlanFull | null>(null);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("engineering");
  const [priority, setPriority] = useState<string>("medium");
  const [startDateTime, setStartDateTime] = useState<string>(() => toLocalDatetimeString(new Date()));
  const [endDateTime, setEndDateTime] = useState<string>(() => toLocalDatetimeString(addDaysToDate(new Date(), 21)));
  const timeboxDays = diffDays(startDateTime, endDateTime);
  const [objective, setObjective] = useState("");
  const [scope, setScope] = useState("");
  const [outcomeType, setOutcomeType] = useState<string>("");
  const [successCriteria, setSuccessCriteria] = useState<string[]>([""]);
  const [endCriteria, setEndCriteria] = useState("");
  const [risks, setRisks] = useState<string[]>([""]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [defineTab, setDefineTab] = useState("basics");
  const [userList, setUserList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [tabErrors, setTabErrors] = useState<Record<string, string>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [showAllMembers, setShowAllMembers] = useState(false);

  useEffect(() => {
    Promise.all([
      usersApi.list(),
      authApi.me().catch(() => ({ user: null })),
    ]).then(([usersRes, meRes]) => {
      const me = meRes.user as User | null;
      setCurrentUser(me);
      // Show every user as an eligible team member / assignee.
      setUserList(usersRes.users);
      // If current user is a Team Lead, auto-select them
      if (me && me.role_type === "Team Lead") {
        setSelectedMembers([me.id]);
      }
    }).catch(() => {});
  }, []);

  const toggleMember = (id: string) => {
    // Team Lead's own entry cannot be deselected
    if (currentUser?.role_type === "Team Lead" && id === currentUser.id) return;
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const resetUpload = () => {
    setUploadedFile(null);
    setExtracted(false);
    setDocumentUrl(null);
    setUploadError(null);
    setUploadProgress(0);
    setTitle("");
    setObjective("");
    setScope("");
    setOutcomeType("");
    setSuccessCriteria([""]);
    setEndCriteria("");
    setRisks([""]);
    setType("engineering");
    setPriority("medium");
    setStartDateTime(toLocalDatetimeString(new Date()));
    setEndDateTime(toLocalDatetimeString(addDaysToDate(new Date(), 21)));
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("File too large — max 8 MB.");
      return;
    }
    setUploadedFile(file.name);
    setUploading(true);
    setUploadProgress(10);

    try {
      // uploadFileSmart picks the transport by size: ≤4 MB goes through the
      // Lambda as base64, larger files upload browser→S3 directly to avoid the
      // Lambda 6 MB payload limit.
      setUploadProgress(40);
      const url = await uploadsApi.uploadFileSmart(file);
      setDocumentUrl(url);
      setUploadProgress(100);
      setUploading(false);
      setUploadProgress(0);

      // AI extraction from the uploaded document
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setExtracting(true);
        try {
          const { extracted: data } = await aiApi.extractDocument(url);
          if (data.title)            setTitle(data.title);
          if (data.objective)        setObjective(data.objective);
          if (data.scope)            setScope(data.scope);
          if (data.outcome_type)     setOutcomeType(data.outcome_type);
          if (data.success_criteria?.length) setSuccessCriteria(data.success_criteria);
          if (data.end_criteria)     setEndCriteria(data.end_criteria);
          if (data.risks?.length)    setRisks(data.risks);
          if (data.type)             setType(data.type);
          if (data.priority)         setPriority(data.priority);
          if (data.timebox_days) {
            const days = Number(data.timebox_days);
            if (days > 0) {
              const start = new Date(startDateTime);
              setEndDateTime(toLocalDatetimeString(addDaysToDate(start, days)));
            }
          }
          setExtracted(true);
        } catch {
          // Extraction failed — user can fill manually, don't block the flow
        }
        setExtracting(false);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.push("/login"); return; }
      if (err instanceof ApiError && err.status === 503) {
        setUploadError("File upload is not configured on the server.");
      } else if (err instanceof ApiError && err.status === 413) {
        setUploadError("File too large — max 8 MB.");
      } else if (err instanceof Error) {
        setUploadError(err.message);
      } else {
        setUploadError("Upload failed — check your connection and try again.");
      }
      setUploadedFile(null);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { plan } = await aiApi.generatePlan({
        requirement: objective,
        objective,
        project_type: type,
        timebox_days: timeboxDays || 21,
        tech_stack: aiPlan?.techStack,
      });
      setAiPlan({
        summary:      plan.summary      ?? "",
        techStack:    plan.techStack    ?? [],
        risks:        plan.risks        ?? [],
        killCriteria: plan.killCriteria ?? [],
        phases:    STANDARD_PHASES,
        milestones: STANDARD_MILESTONES,
      });
      setPlanGenerated(true);
      setStep(1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.push("/login"); return; }
      setGenerateError(err instanceof ApiError ? err.message : "Failed to generate plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegeneratePlan = async () => {
    setGenerating(true);
    setGenerateError(null);
    setPlanGenerated(false);
    try {
      const { plan } = await aiApi.generatePlan({
        requirement: objective,
        objective,
        project_type: type,
        timebox_days: timeboxDays || 21,
      });
      setAiPlan({
        summary:      plan.summary      ?? "",
        techStack:    plan.techStack    ?? [],
        risks:        plan.risks        ?? [],
        killCriteria: plan.killCriteria ?? [],
        phases:    STANDARD_PHASES,
        milestones: STANDARD_MILESTONES,
      });
      setPlanGenerated(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.push("/login"); return; }
      setGenerateError(err instanceof ApiError ? err.message : "Failed to regenerate plan.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    setCreateError(null);
    try {
      const ownerId = selectedMembers[0] || "";
      const result = await projectsApi.create({
        title,
        type,
        requirement: objective,
        objective,
        outcome_type:        outcomeType || "other",
        outcome_description: scope,
        priority,
        owner_id:     ownerId,
        assignee_ids: selectedMembers.length > 0 ? selectedMembers : undefined,
        timebox_days: timeboxDays || 21,
        start_date:   (startDateTime || "").slice(0, 10) || new Date().toISOString().split("T")[0],
        end_date:     (endDateTime || "").slice(0, 10) || undefined,
        tech_stack:   aiPlan?.techStack ?? [],
        ai_plan:      aiPlan
          ? { summary: aiPlan.summary, techStack: aiPlan.techStack, risks: aiPlan.risks, killCriteria: aiPlan.killCriteria }
          : undefined,
        document_url: documentUrl ?? undefined,
      });
      router.push(`/projects/${result.project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { router.push("/login"); return; }
      setCreateError(err instanceof ApiError ? err.message : "Failed to create project. Please try again.");
    }
  };

  const addSuccessCriteria = () => setSuccessCriteria([...successCriteria, ""]);
  const removeSuccessCriteria = (i: number) => setSuccessCriteria(successCriteria.filter((_, idx) => idx !== i));
  const updateSuccessCriteria = (i: number, val: string) => {
    const updated = [...successCriteria]; updated[i] = val; setSuccessCriteria(updated);
  };
  const addRisk    = () => setRisks([...risks, ""]);
  const removeRisk = (i: number) => setRisks(risks.filter((_, idx) => idx !== i));
  const updateRisk = (i: number, val: string) => {
    const updated = [...risks]; updated[i] = val; setRisks(updated);
  };

  const filledCriteria = successCriteria.filter(s => s.trim() !== "").length;
  const canProceedToGenerate =
    title.trim() !== "" &&
    objective.trim() !== "" &&
    scope.trim() !== "" &&
    outcomeType !== "" &&
    filledCriteria > 0 &&
    endCriteria.trim() !== "" &&
    startDateTime !== "" &&
    endDateTime !== "" &&
    selectedMembers.length > 0;

  const severityColors: Record<string, string> = {
    high:   "text-red-700 border-red-200 bg-red-50",
    medium: "text-amber-700 border-amber-200 bg-amber-50",
    low:    "text-slate-700 border-slate-200 bg-slate-50",
  };

  const basicsComplete  = title.trim() !== "" && type !== "" && priority !== "";
  const scopeComplete   = objective.trim() !== "" && scope.trim() !== "";
  const outcomeComplete = outcomeType !== "" && filledCriteria > 0 && endCriteria.trim() !== "";
  const teamComplete    = selectedMembers.length > 0;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Project</h1>
          <p className="text-sm text-muted-foreground">Define project scope and let AI generate the execution plan</p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              i === step       ? "bg-blue-50 text-blue-600 border border-blue-200"
              : i < step      ? "bg-green-50 text-green-600 border border-green-200"
              : "bg-muted text-muted-foreground border border-transparent"
            }`}>
              {i < step
                ? <CheckCircle2 className="h-4 w-4" />
                : <span className="h-4 w-4 flex items-center justify-center text-xs">{i + 1}</span>}
              {label}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Define ── */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Document Upload */}
          <Card>
            <CardContent className="pt-6">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file).catch(() => {});
                  e.target.value = "";
                }}
              />
              {!uploadedFile ? (
                <>
                  <div
                    className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                      <Upload className="h-6 w-6 text-blue-500" />
                    </div>
                    <p className="font-medium text-sm">Upload Project Brief / Requirements Document</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF — AI will extract objectives, scope, success criteria, and more (max 8 MB)
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-3">
                      <Badge variant="outline" className="text-[10px]">PDF</Badge>
                    </div>
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-600 mt-2 text-center">{uploadError}</p>
                  )}
                </>
              ) : uploading ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="font-medium text-sm text-blue-700">Uploading {uploadedFile}… {uploadProgress}%</p>
                  <div className="w-full bg-blue-100 rounded-full h-1.5 mt-3">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-blue-500 mt-2">Uploading via server — no browser CORS issues</p>
                </div>
              ) : extracting ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                  <p className="font-medium text-sm text-blue-700">Analyzing document with Claude AI...</p>
                  <p className="text-xs text-blue-500 mt-1">Extracting objectives, scope, success criteria, outcome type…</p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {documentUrl ? (
                          <a href={documentUrl} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium truncate text-blue-600 hover:underline">
                            {uploadedFile}
                          </a>
                        ) : (
                          <p className="text-sm font-medium truncate">{uploadedFile}</p>
                        )}
                        {extracted && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                            <Check className="h-2.5 w-2.5 mr-0.5" /> AI Extracted
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {extracted ? "Fields auto-populated — review and edit below" : "Uploaded — fill fields below"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-600" onClick={resetUpload}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!uploadedFile && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">OR FILL MANUALLY</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Tabbed Project Definition */}
          <Card>
            <Tabs value={defineTab} onValueChange={setDefineTab}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Project Definition</CardTitle>
                <TabsList className="grid grid-cols-4 mt-2">
                  <TabsTrigger value="basics" className="text-xs gap-1.5 relative">
                    <Layers className="h-3 w-3" />Basics
                    {basicsComplete && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />}
                  </TabsTrigger>
                  <TabsTrigger value="scope" className="text-xs gap-1.5 relative">
                    <Target className="h-3 w-3" />Scope & Objective
                    {scopeComplete && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />}
                  </TabsTrigger>
                  <TabsTrigger value="outcome" className="text-xs gap-1.5 relative">
                    <ListChecks className="h-3 w-3" />Outcome & Criteria
                    {outcomeComplete && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />}
                  </TabsTrigger>
                  <TabsTrigger value="team" className="text-xs gap-1.5 relative">
                    <PackageCheck className="h-3 w-3" />Team & Timeline
                    {teamComplete && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500" />}
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                {/* Tab 1: Basics */}
                <TabsContent value="basics" className="space-y-5 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title<span className="text-red-500">*</span></Label>
                    <Input
                      id="title"
                      placeholder="e.g., Customer Churn Prediction Platform"
                      value={title}
                      onChange={e => { setTitle(e.target.value); if (tabErrors.title) setTabErrors(p => ({ ...p, title: "" })); }}
                      className={tabErrors.title ? "border-red-400 focus-visible:ring-red-300" : extracted && title ? "border-emerald-200 bg-emerald-50/30" : ""}
                    />
                    {tabErrors.title && <p className="text-xs text-red-500">{tabErrors.title}</p>}
                    {!tabErrors.title && extracted && title && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Auto-filled from document
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type<span className="text-red-500">*</span></Label>
                      <Select value={type} onValueChange={v => v && setType(v)}>
                        <SelectTrigger>
                          <SelectValue>
                            {({ engineering: "Engineering", research: "Research / DS", mixed: "Mixed (Eng + Research)" } as Record<string, string>)[type] ?? type}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engineering">Engineering</SelectItem>
                          <SelectItem value="research">Research / DS</SelectItem>
                          <SelectItem value="mixed">Mixed (Eng + Research)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority<span className="text-red-500">*</span></Label>
                      <Select value={priority} onValueChange={v => v && setPriority(v)}>
                        <SelectTrigger>
                          <SelectValue>
                            {({ low: "Low", medium: "Medium", high: "High", critical: "Critical" } as Record<string, string>)[priority] ?? priority}
                          </SelectValue>
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
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                      const errs: Record<string, string> = {};
                      if (!title.trim()) errs.title = "Please enter Project Title";
                      setTabErrors(errs);
                      if (Object.keys(errs).length === 0) setDefineTab("scope");
                    }}>
                      Next: Scope & Objective <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 2: Scope & Objective */}
                <TabsContent value="scope" className="space-y-5 mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="objective">
                      Project Objective<span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">What are we trying to achieve?</span>
                    </Label>
                    <Textarea
                      id="objective"
                      placeholder="Describe the core goal — what problem does this solve, and for whom?"
                      value={objective}
                      onChange={e => { setObjective(e.target.value); if (tabErrors.objective) setTabErrors(p => ({ ...p, objective: "" })); }}
                      rows={4}
                      className={tabErrors.objective ? "border-red-400" : extracted && objective ? "border-emerald-200 bg-emerald-50/30" : ""}
                    />
                    {tabErrors.objective && <p className="text-xs text-red-500">{tabErrors.objective}</p>}
                    {!tabErrors.objective && extracted && objective && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Auto-filled</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scope">
                      Scope<span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">What&apos;s in and what&apos;s out?</span>
                    </Label>
                    <Textarea
                      id="scope"
                      placeholder="Define boundaries — what's included and what's explicitly out of scope..."
                      value={scope}
                      onChange={e => { setScope(e.target.value); if (tabErrors.scope) setTabErrors(p => ({ ...p, scope: "" })); }}
                      rows={4}
                      className={tabErrors.scope ? "border-red-400" : extracted && scope ? "border-emerald-200 bg-emerald-50/30" : ""}
                    />
                    {tabErrors.scope && <p className="text-xs text-red-500">{tabErrors.scope}</p>}
                    {!tabErrors.scope && extracted && scope && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Auto-filled</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Known Risks
                      <span className="text-xs text-muted-foreground font-normal ml-2">Optional</span>
                    </Label>
                    <div className="space-y-2">
                      {risks.map((risk, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <Input
                            placeholder={`Risk ${i + 1}...`}
                            value={risk}
                            onChange={e => updateRisk(i, e.target.value)}
                            className={`flex-1 text-sm ${extracted && risk ? "border-emerald-200 bg-emerald-50/30" : ""}`}
                          />
                          {risks.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" onClick={() => removeRisk(i)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={addRisk}>
                        <Plus className="h-3 w-3" /> Add Risk
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDefineTab("basics")}>
                      <ArrowLeft className="h-3 w-3" /> Back
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                      const errs: Record<string, string> = {};
                      if (!objective.trim()) errs.objective = "Please enter Project Objective";
                      if (!scope.trim()) errs.scope = "Please enter Scope";
                      setTabErrors(errs);
                      if (Object.keys(errs).length === 0) setDefineTab("outcome");
                    }}>
                      Next: Outcome & Criteria <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 3: Outcome & Criteria */}
                <TabsContent value="outcome" className="space-y-5 mt-0">
                  <div className="space-y-3">
                    <Label>
                      Project Outcome Type<span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">What kind of project is this?</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {OUTCOME_TYPES.map(ot => (
                        <div
                          key={ot.value}
                          className={`p-3 rounded-lg border cursor-pointer transition-all text-center ${
                            outcomeType === ot.value
                              ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                              : tabErrors.outcomeType
                              ? "border-red-200 hover:border-red-300 hover:bg-red-50/30"
                              : "border-border hover:border-gray-300 hover:bg-gray-50"
                          }`}
                          onClick={() => { setOutcomeType(ot.value); if (tabErrors.outcomeType) setTabErrors(p => ({ ...p, outcomeType: "" })); }}
                        >
                          <span className="text-lg">{ot.icon}</span>
                          <p className="text-xs font-medium mt-1">{ot.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{ot.description}</p>
                        </div>
                      ))}
                    </div>
                    {tabErrors.outcomeType && <p className="text-xs text-red-500">{tabErrors.outcomeType}</p>}
                    {!tabErrors.outcomeType && extracted && outcomeType && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Auto-detected</p>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>
                        Success Criteria<span className="text-red-500">*</span>
                        <span className="text-xs text-muted-foreground font-normal ml-2">How do we measure success?</span>
                      </Label>
                      <Badge variant="outline" className="text-[10px]">{filledCriteria} defined</Badge>
                    </div>
                    <div className="space-y-2">
                      {successCriteria.map((sc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <Input
                            placeholder={`Criterion ${i + 1} — e.g., "Model precision >80%"`}
                            value={sc}
                            onChange={e => { updateSuccessCriteria(i, e.target.value); if (tabErrors.successCriteria) setTabErrors(p => ({ ...p, successCriteria: "" })); }}
                            className={`flex-1 text-sm ${extracted && sc ? "border-emerald-200 bg-emerald-50/30" : ""}`}
                          />
                          {successCriteria.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" onClick={() => removeSuccessCriteria(i)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={addSuccessCriteria}>
                        <Plus className="h-3 w-3" /> Add Criterion
                      </Button>
                    </div>
                    {tabErrors.successCriteria && <p className="text-xs text-red-500">{tabErrors.successCriteria}</p>}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="endCriteria">
                      Project Completion Definition<span className="text-red-500">*</span>
                      <span className="text-xs text-muted-foreground font-normal ml-2">When is this project &quot;done&quot;?</span>
                    </Label>
                    <Textarea
                      id="endCriteria"
                      placeholder="Define what constitutes project completion — deliverables, sign-offs, deployment state..."
                      value={endCriteria}
                      onChange={e => { setEndCriteria(e.target.value); if (tabErrors.endCriteria) setTabErrors(p => ({ ...p, endCriteria: "" })); }}
                      rows={3}
                      className={tabErrors.endCriteria ? "border-red-400" : extracted && endCriteria ? "border-emerald-200 bg-emerald-50/30" : ""}
                    />
                    {tabErrors.endCriteria && <p className="text-xs text-red-500">{tabErrors.endCriteria}</p>}
                    {!tabErrors.endCriteria && extracted && endCriteria && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Auto-filled</p>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDefineTab("scope")}>
                      <ArrowLeft className="h-3 w-3" /> Back
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                      const errs: Record<string, string> = {};
                      if (!outcomeType) errs.outcomeType = "Please select Project Outcome Type";
                      if (filledCriteria === 0) errs.successCriteria = "Please enter at least one Success Criterion";
                      if (!endCriteria.trim()) errs.endCriteria = "Please enter Project Completion Definition";
                      setTabErrors(errs);
                      if (Object.keys(errs).length === 0) setDefineTab("team");
                    }}>
                      Next: Team & Timeline <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </TabsContent>

                {/* Tab 4: Team & Timeline */}
                <TabsContent value="team" className="space-y-5 mt-0">
                  <div className="space-y-2">
                    <Label>Project Timeline</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="start-datetime" className="text-xs text-muted-foreground font-normal">
                          Start date &amp; time<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="start-datetime"
                          type="datetime-local"
                          value={startDateTime}
                          onChange={e => { setStartDateTime(e.target.value); if (tabErrors.startDate) setTabErrors(p => ({ ...p, startDate: "" })); }}
                          className={tabErrors.startDate ? "border-red-400" : "cursor-pointer"}
                          onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                        />
                        {tabErrors.startDate && <p className="text-xs text-red-500">{tabErrors.startDate}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="end-datetime" className="text-xs text-muted-foreground font-normal">
                          End date &amp; time<span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="end-datetime"
                          type="datetime-local"
                          value={endDateTime}
                          min={startDateTime || undefined}
                          onChange={e => { setEndDateTime(e.target.value); if (tabErrors.endDate) setTabErrors(p => ({ ...p, endDate: "" })); }}
                          className={tabErrors.endDate ? "border-red-400" : "cursor-pointer"}
                          onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                        />
                        {tabErrors.endDate && <p className="text-xs text-red-500">{tabErrors.endDate}</p>}
                      </div>
                    </div>
                    {startDateTime && endDateTime && (
                      <p className="text-[11px] text-muted-foreground">
                        {timeboxDays > 0
                          ? <>Spans <strong>{timeboxDays}</strong> day{timeboxDays === 1 ? "" : "s"} (~{Math.ceil(timeboxDays / 7)} week{Math.ceil(timeboxDays / 7) === 1 ? "" : "s"}).</>
                          : <span className="text-amber-600">End must be after start.</span>}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Team Members<span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="Search members…"
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        className="h-8 text-sm max-w-[220px]"
                      />
                    </div>
                    {(() => {
                      const filtered = userList.filter(u =>
                        u.name.toLowerCase().includes(memberSearch.toLowerCase())
                      );
                      const visible = showAllMembers ? filtered : filtered.slice(0, 6);
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            {visible.map(user => {
                              const isLocked = currentUser?.role_type === "Team Lead" && user.id === currentUser.id;
                              return (
                              <div
                                key={user.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                  isLocked
                                    ? "border-blue-300 bg-blue-50 cursor-not-allowed opacity-80"
                                    : selectedMembers.includes(user.id)
                                    ? "border-blue-300 bg-blue-50 cursor-pointer"
                                    : "border-border hover:bg-gray-100 cursor-pointer"
                                }`}
                                onClick={() => { if (!isLocked) { toggleMember(user.id); if (tabErrors.members) setTabErrors(p => ({ ...p, members: "" })); } }}
                              >
                                <Checkbox checked={selectedMembers.includes(user.id)} disabled={isLocked} onCheckedChange={() => { if (!isLocked) { toggleMember(user.id); if (tabErrors.members) setTabErrors(p => ({ ...p, members: "" })); } }} />
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                  style={{ backgroundColor: user.avatar_color }}
                                >
                                  {user.name[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{user.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{user.role_type}{isLocked && " (you)"}</p>
                                </div>
                              </div>
                              );
                            })}
                            {filtered.length === 0 && (
                              <p className="text-sm text-muted-foreground col-span-2 text-center py-4">No members match &quot;{memberSearch}&quot;</p>
                            )}
                          </div>
                          {filtered.length > 6 && (
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:underline mt-1"
                              onClick={() => setShowAllMembers(v => !v)}
                            >
                              {showAllMembers ? `Show Less` : `Show All (${filtered.length})`}
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {tabErrors.members && <p className="text-xs text-red-500 mt-1">{tabErrors.members}</p>}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDefineTab("outcome")}>
                      <ArrowLeft className="h-3 w-3" /> Back
                    </Button>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          {/* Readiness & Generate */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4 mb-4">
                <p className="text-sm font-medium">Readiness</p>
                <div className="flex items-center gap-2 flex-1">
                  {[
                    { label: "Basics",  done: basicsComplete  },
                    { label: "Scope",   done: scopeComplete   },
                    { label: "Outcome", done: outcomeComplete },
                    { label: "Team",    done: teamComplete    },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                      {item.done
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        : <div className="h-3.5 w-3.5 rounded-full border border-gray-300" />}
                      <span className={`text-xs ${item.done ? "text-emerald-700" : "text-muted-foreground"}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {generateError && (
                <p className="text-xs text-red-600 text-center mb-3">{generateError}</p>
              )}
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!canProceedToGenerate || generating}
                onClick={handleGeneratePlan}
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating AI Plan...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate AI Execution Plan</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: AI Plan ── */}
      {step === 1 && planGenerated && aiPlan && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI-Generated Execution Plan
              </CardTitle>
              <CardDescription>{aiPlan.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Phases */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Project Phases (with Gate Reviews)
                </h3>
                <div className="space-y-2">
                  {aiPlan.phases.map((phase, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border bg-gray-50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{phase.name}</p>
                          <Badge variant="outline" className="text-xs">{phase.estimatedDuration}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground ml-10">{phase.description}</p>
                      <div className="ml-10 mt-2 flex flex-wrap gap-1.5">
                        {phase.deliverables.map((d, j) => (
                          <Badge key={j} variant="secondary" className="text-[10px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Milestones */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key Milestones</h3>
                <div className="space-y-2">
                  {aiPlan.milestones.map((ms, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-gray-50">
                      <div className="h-6 w-6 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{ms.title}</p>
                          <Badge variant="outline" className="text-xs">Day {ms.targetDay}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ms.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tech Stack */}
              {aiPlan.techStack && aiPlan.techStack.length > 0 && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Suggested Tech Stack</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiPlan.techStack.map(tech => (
                        <Badge key={tech} variant="secondary">{tech}</Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Risks */}
              {aiPlan.risks && aiPlan.risks.length > 0 && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Risks & Mitigations</h3>
                    <div className="space-y-2">
                      {aiPlan.risks.map((r, i) => (
                        <div key={i} className="p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-sm font-medium">{r.risk}</span>
                            <Badge variant="outline" className={severityColors[r.severity ?? "medium"]}>{r.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground ml-5">Mitigation: {r.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Kill Criteria */}
              {aiPlan.killCriteria && aiPlan.killCriteria.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kill Criteria</h3>
                  <div className="space-y-2">
                    {aiPlan.killCriteria.map((kc, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-red-50 border border-red-200">
                        <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>{kc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {generateError && (
            <p className="text-sm text-red-600 text-center">{generateError}</p>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-1" />Edit Details
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" disabled={generating} onClick={handleRegeneratePlan}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate
              </Button>
              <Button className="gap-2" onClick={() => setStep(2)}>
                <CheckCircle2 className="h-4 w-4" />Approve Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Create ── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review & Create</CardTitle>
              <CardDescription>Confirm the project details before creation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
                  <p className="font-medium mt-1">{title || "Untitled"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
                  <Badge variant="outline" className={
                    type === "engineering"
                      ? "text-blue-700 border-blue-200 bg-blue-50 mt-1"
                      : "text-purple-700 border-purple-200 bg-purple-50 mt-1"
                  }>
                    {type === "engineering" ? "Engineering" : type === "research" ? "Research" : "Mixed"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Priority</p>
                  <p className="font-medium mt-1 capitalize">{priority}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</p>
                  <p className="font-medium mt-1 text-sm">
                    {startDateTime ? new Date(startDateTime).toLocaleString() : "—"}
                    <span className="mx-1 text-muted-foreground">→</span>
                    {endDateTime ? new Date(endDateTime).toLocaleString() : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{timeboxDays} day{timeboxDays === 1 ? "" : "s"}</p>
                </div>
              </div>

              <Separator />

              {outcomeType && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Outcome Type</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{OUTCOME_TYPES.find(o => o.value === outcomeType)?.icon}</span>
                      <span className="font-medium">{OUTCOME_TYPES.find(o => o.value === outcomeType)?.label}</span>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Objective</p>
                <p className="text-sm">{objective || "Not defined"}</p>
              </div>

              {scope && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Scope</p>
                  <p className="text-sm">{scope}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Success Criteria ({filledCriteria})
                </p>
                <div className="space-y-1.5">
                  {successCriteria.filter(s => s.trim()).map((sc, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{sc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {endCriteria && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completion Definition</p>
                  <p className="text-sm">{endCriteria}</p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Team</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map(id => {
                    const user = userList.find(u => u.id === id);
                    return user ? (
                      <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-gray-50">
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: user.avatar_color }}
                        >
                          {user.name[0]}
                        </div>
                        <span className="text-sm">{user.name}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {aiPlan && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {aiPlan.phases.length} Phases with Gate Reviews
                    </p>
                    <div className="space-y-1.5">
                      {aiPlan.phases.map((phase, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="h-5 w-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</div>
                          <span>{phase.name}</span>
                          <span className="text-xs text-muted-foreground">({phase.estimatedDuration})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {aiPlan.milestones.length} Key Milestones
                    </p>
                    <div className="space-y-1.5">
                      {aiPlan.milestones.map((ms, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <span>{ms.title}</span>
                          <span className="text-xs text-muted-foreground">(Day {ms.targetDay})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {documentUrl && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Attached Document</p>
                    <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />{uploadedFile}
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {createError && (
              <p className="text-sm text-red-600 text-center">{createError}</p>
            )}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" />Back to Plan
              </Button>
              <Button size="lg" className="gap-2" onClick={handleCreate}>
                <Rocket className="h-4 w-4" />Create Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generating overlay */}
      {step === 0 && generating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="p-8 text-center space-y-4">
            <Sparkles className="h-8 w-8 text-blue-600 mx-auto animate-pulse" />
            <div>
              <p className="font-semibold">Generating AI Execution Plan...</p>
              <p className="text-sm text-muted-foreground">Claude is analysing your objective and constraints</p>
            </div>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
          </Card>
        </div>
      )}
    </div>
  );
}
