"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fireMilestoneCelebration } from "@/lib/confetti";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Play,
  Sparkles,
  Loader2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  MessageSquare,
  Clock,
  FileText,
  Code,
  Layout,
  BookOpen,
  Monitor,
} from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";

const submissionTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  architecture: <Layout className="h-4 w-4" />,
  notebook: <BookOpen className="h-4 w-4" />,
  demo: <Monitor className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  engineering: "text-blue-700 border-blue-200 bg-blue-50",
  research: "text-purple-700 border-purple-200 bg-purple-50",
  mixed: "text-teal-700 border-teal-200 bg-teal-50",
  data_science: "text-violet-700 border-violet-200 bg-violet-50",
  design: "text-pink-700 border-pink-200 bg-pink-50",
  sales: "text-orange-700 border-orange-200 bg-orange-50",
  marketing: "text-rose-700 border-rose-200 bg-rose-50",
  operations: "text-slate-700 border-slate-200 bg-slate-50",
  hr: "text-cyan-700 border-cyan-200 bg-cyan-50",
  legal: "text-gray-700 border-gray-200 bg-gray-50",
  strategy: "text-indigo-700 border-indigo-200 bg-indigo-50",
  product: "text-emerald-700 border-emerald-200 bg-emerald-50",
  finance: "text-amber-700 border-amber-200 bg-amber-50",
};

const typeLabels: Record<string, string> = {
  engineering: "Engineering",
  research: "Research/DS",
  mixed: "Mixed",
  data_science: "Data Science",
  design: "Design",
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  hr: "HR",
  legal: "Legal",
  strategy: "Strategy",
  product: "Product",
  finance: "Finance",
};

export function ProjectDetailClient({
  project: initialProject,
  users,
}: {
  project: any;
  users: any[];
}) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [checkpointDecision, setCheckpointDecision] = useState<"continue" | "kill">("continue");
  const [submitting, setSubmitting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitPhaseId, setSubmitPhaseId] = useState("");
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitType, setSubmitType] = useState("document");
  const [submitDesc, setSubmitDesc] = useState("");
  const [submitLink, setSubmitLink] = useState("");
  const [feedbackText, setFeedbackText] = useState<Record<string, string>>({});
  const [aiReviewing, setAiReviewing] = useState<string | null>(null);

  const phases = project.phases;
  const completedPhases = phases.filter((p: any) => p.status === "completed").length;
  const progress = Math.round((completedPhases / phases.length) * 100);
  const endDate = addDays(new Date(project.startDate), project.timeboxDays);
  const daysLeft = differenceInDays(endDate, new Date());
  const techStack = JSON.parse(project.techStack || "[]");
  const aiPlan = JSON.parse(project.aiPlan || "{}");

  async function advancePhase(currentPhaseId: string, nextPhaseId: string | null) {
    await fetch("/api/phases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phaseId: currentPhaseId,
        status: "completed",
        projectId: project.id,
        nextPhaseId,
      }),
    });
    // Celebrate milestone completion
    fireMilestoneCelebration();
    setTimeout(() => {
      router.refresh();
      window.location.reload();
    }, 1200);
  }

  async function submitCheckpoint() {
    setSubmitting(true);
    await fetch("/api/checkpoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        decision: checkpointDecision,
        notes: checkpointNotes,
      }),
    });
    setCheckpointOpen(false);
    setCheckpointNotes("");
    setSubmitting(false);
    router.refresh();
    window.location.reload();
  }

  async function submitWork() {
    setSubmitting(true);
    await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phaseId: submitPhaseId,
        projectId: project.id,
        userId: users[0]?.id,
        title: submitTitle,
        type: submitType,
        description: submitDesc,
        link: submitLink,
      }),
    });
    setSubmitOpen(false);
    setSubmitTitle("");
    setSubmitDesc("");
    setSubmitLink("");
    setSubmitting(false);
    router.refresh();
    window.location.reload();
  }

  async function sendFeedback(submissionId: string) {
    const text = feedbackText[submissionId];
    if (!text) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionId,
        fromUserId: users[0]?.id,
        text,
        isAi: false,
      }),
    });
    setFeedbackText((prev) => ({ ...prev, [submissionId]: "" }));
    router.refresh();
    window.location.reload();
  }

  async function aiReview(submission: any) {
    setAiReviewing(submission.id);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: submission.title,
          type: submission.type,
          description: submission.description,
          projectContext: project.requirement,
        }),
      });
      const data = await res.json();
      setFeedbackText((prev) => ({
        ...prev,
        [submission.id]: data.feedback,
      }));
    } catch {
      alert("AI review failed");
    } finally {
      setAiReviewing(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <Badge variant="outline" className={typeColors[project.type] || "text-gray-700 border-gray-200 bg-gray-50"}>
              {typeLabels[project.type] || project.type}
            </Badge>
            <Badge
              variant="outline"
              className={
                project.status === "active"
                  ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                  : project.status === "completed"
                    ? "text-green-600 border-green-200 bg-green-50"
                    : "text-red-600 border-red-200 bg-red-50"
              }
            >
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-2">{project.requirement}</p>
        </div>
        {project.status === "active" && (
          <Dialog open={checkpointOpen} onOpenChange={setCheckpointOpen}>
            <DialogTrigger>
              <Button variant="outline" className="gap-2 shrink-0">
                <AlertTriangle className="h-4 w-4" />
                Checkpoint Review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Checkpoint Review</DialogTitle>
                <DialogDescription>
                  Assess the project and decide whether to continue or kill it
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={checkpointNotes}
                    onChange={(e) => setCheckpointNotes(e.target.value)}
                    placeholder="What have we learned? What's blocking progress? Is the hypothesis still viable?"
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <div className="flex gap-3">
                    <Button
                      variant={checkpointDecision === "continue" ? "default" : "outline"}
                      onClick={() => setCheckpointDecision("continue")}
                      className="flex-1 gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Continue
                    </Button>
                    <Button
                      variant={checkpointDecision === "kill" ? "destructive" : "outline"}
                      onClick={() => setCheckpointDecision("kill")}
                      className="flex-1 gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Kill
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={submitCheckpoint}
                  disabled={!checkpointNotes || submitting}
                  className="w-full"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Submit Checkpoint
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-sm font-medium">{progress}%</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Current Phase</p>
            <p className="text-sm font-medium mt-1">{project.currentPhase}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Time Remaining</p>
            <p className={`text-sm font-medium mt-1 ${daysLeft < 0 ? "text-red-600" : daysLeft < 3 ? "text-amber-600" : ""}`}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Team</p>
            <div className="flex -space-x-1.5 mt-1.5">
              {project.assignees.map((a: any) => (
                <div
                  key={a.user.id}
                  className="h-6 w-6 rounded-full border border-background flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: a.user.avatarColor }}
                  title={a.user.name}
                >
                  {a.user.name[0]}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tech Stack */}
      {techStack.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Tech Stack:</span>
          {techStack.map((t: string) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      )}

      {/* Phase Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Phases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {phases.map((phase: any, index: number) => {
            const isActive = phase.status === "active";
            const isCompleted = phase.status === "completed";
            const checklist = JSON.parse(phase.checklist || "[]");
            const nextPhase = phases[index + 1] || null;

            return (
              <div key={phase.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : isActive ? (
                        <Play className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <h3
                        className={`font-medium ${
                          isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-muted-foreground"
                        }`}
                      >
                        {phase.phaseName}
                      </h3>
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? "text-blue-600 border-blue-200"
                            : isCompleted
                              ? "text-green-600 border-green-200"
                              : ""
                        }
                      >
                        {phase.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && project.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              setSubmitPhaseId(phase.id);
                              setSubmitOpen(true);
                            }}
                          >
                            Submit Work
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              advancePhase(phase.id, nextPhase?.id || null)
                            }
                          >
                            Complete Phase
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Checklist */}
                  {(isActive || isCompleted) && checklist.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {checklist.map((item: string, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )}
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submissions for this phase */}
                  {phase.submissions.length > 0 && (
                    <div className="ml-8 space-y-3">
                      {phase.submissions.map((sub: any) => (
                        <Card key={sub.id} className="bg-gray-50">
                          <CardContent className="pt-4 pb-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {submissionTypeIcons[sub.type]}
                                <span className="font-medium text-sm">
                                  {sub.title}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {sub.type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div
                                  className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                  style={{
                                    backgroundColor: sub.user.avatarColor,
                                  }}
                                >
                                  {sub.user.name[0]}
                                </div>
                                {sub.user.name}
                                <Clock className="h-3 w-3 ml-1" />
                                {format(new Date(sub.createdAt), "MMM d, HH:mm")}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {sub.description}
                            </p>
                            {sub.link && (
                              <p className="text-xs text-blue-600">
                                {sub.link}
                              </p>
                            )}

                            {/* Existing feedback */}
                            {sub.feedback.length > 0 && (
                              <div className="space-y-2 mt-2">
                                {sub.feedback.map((fb: any) => (
                                  <div
                                    key={fb.id}
                                    className="p-2 rounded bg-background text-sm"
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <MessageSquare className="h-3 w-3" />
                                      <span className="font-medium text-xs">
                                        {fb.fromUser.name}
                                      </span>
                                      {fb.isAi && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          AI
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(fb.createdAt), "MMM d, HH:mm")}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground whitespace-pre-wrap">
                                      {fb.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Review actions */}
                            {project.status === "active" && (
                              <div className="space-y-2">
                                <Textarea
                                  value={feedbackText[sub.id] || ""}
                                  onChange={(e) =>
                                    setFeedbackText((prev) => ({
                                      ...prev,
                                      [sub.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Write feedback..."
                                  className="min-h-[60px] text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => aiReview(sub)}
                                    disabled={aiReviewing === sub.id}
                                  >
                                    {aiReviewing === sub.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-3 w-3" />
                                    )}
                                    AI Review
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => sendFeedback(sub.id)}
                                    disabled={!feedbackText[sub.id]}
                                  >
                                    Send Feedback
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Checkpoint History */}
      {project.checkpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Checkpoint History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {project.checkpoints.map((cp: any) => (
              <div
                key={cp.id}
                className={`p-3 rounded-lg border ${
                  cp.decision === "kill"
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {cp.decision === "kill" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Play className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-medium text-sm capitalize">
                    {cp.decision}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(cp.createdAt), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{cp.notes}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Plan Details */}
      {aiPlan.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              AI Plan
            </CardTitle>
            <CardDescription>{aiPlan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiPlan.killCriteria && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Kill Criteria</h4>
                <ul className="space-y-1">
                  {aiPlan.killCriteria.map((k: string, i: number) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiPlan.risks && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Risks</h4>
                {aiPlan.risks.map((r: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground mb-1">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    <strong>{r.risk}</strong> — {r.mitigation}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit Work Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Work</DialogTitle>
            <DialogDescription>
              Submit a deliverable for review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                placeholder="e.g., API Design Document v1"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={submitType} onValueChange={(v) => v && setSubmitType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="code">Code / PR</SelectItem>
                  <SelectItem value="architecture">Architecture</SelectItem>
                  <SelectItem value="notebook">Notebook</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description / Notes</Label>
              <Textarea
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                placeholder="Describe what you're submitting..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input
                value={submitLink}
                onChange={(e) => setSubmitLink(e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
            <Button
              onClick={submitWork}
              disabled={!submitTitle || !submitDesc || submitting}
              className="w-full"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
