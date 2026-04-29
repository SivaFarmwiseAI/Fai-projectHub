import { differenceInDays, addDays } from "date-fns";
import type { Project } from "@/lib/api-client";

export type HealthScore = {
  score: number;        // 0–100
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  color: string;        // tailwind text color
  bg: string;           // tailwind bg color
  border: string;       // tailwind border color
  breakdown: { label: string; points: number; max: number }[];
};

export function computeHealthScore(project: Project): HealthScore {
  if (project.status === "completed") {
    return { score: 100, grade: "A", label: "Completed", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", breakdown: [] };
  }
  if (project.status === "killed") {
    return { score: 0, grade: "F", label: "Killed", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", breakdown: [] };
  }

  const breakdown: { label: string; points: number; max: number }[] = [];

  // 1. Phase progress (0–30)
  const phases = project.phases ?? [];
  const completedPhases = phases.filter(p => p.status === "completed").length;
  const phaseScore = phases.length ? Math.round((completedPhases / phases.length) * 30) : 15;
  breakdown.push({ label: "Phase Progress", points: phaseScore, max: 30 });

  // 2. Timeline health (0–25)
  const startDate = project.start_date ?? project.created_at;
  const daysLeft = differenceInDays(addDays(new Date(startDate), project.timebox_days), new Date());
  let timeScore = 25;
  if (daysLeft < 0) timeScore = 0;
  else if (daysLeft < 3) timeScore = 8;
  else if (daysLeft < 7) timeScore = 15;
  breakdown.push({ label: "Timeline", points: timeScore, max: 25 });

  // 3. Task health (0–25) — use summary counts from project if available
  const completedCount = project.completed_tasks ?? 0;
  const totalCount = project.task_count ?? 0;
  let taskScore = totalCount ? Math.round((completedCount / totalCount) * 25) : 12;
  breakdown.push({ label: "Task Health", points: taskScore, max: 25 });

  // 4. Activity score (0–20) — no direct updates field; use phase progress as proxy
  const activityScore = phaseScore > 0 ? Math.min(20, Math.round(phaseScore * 0.67)) : 0;
  breakdown.push({ label: "Recent Activity", points: activityScore, max: 20 });

  const score = Math.min(100, phaseScore + timeScore + taskScore + activityScore);

  let grade: HealthScore["grade"] = "A";
  let label = "Healthy";
  let color = "text-emerald-700";
  let bg    = "bg-emerald-50";
  let border = "border-emerald-200";

  if (score >= 80) { grade = "A"; label = "Healthy";   color = "text-emerald-700"; bg = "bg-emerald-50"; border = "border-emerald-200"; }
  else if (score >= 60) { grade = "B"; label = "Good";   color = "text-blue-700";    bg = "bg-blue-50";    border = "border-blue-200"; }
  else if (score >= 40) { grade = "C"; label = "Fair";   color = "text-amber-700";   bg = "bg-amber-50";   border = "border-amber-200"; }
  else if (score >= 20) { grade = "D"; label = "At Risk"; color = "text-orange-700";  bg = "bg-orange-50";  border = "border-orange-200"; }
  else                  { grade = "F"; label = "Critical"; color = "text-red-700";    bg = "bg-red-50";     border = "border-red-200"; }

  return { score, grade, label, color, bg, border, breakdown };
}
