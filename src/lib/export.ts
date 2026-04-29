/** Generic CSV builder and download utility */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Project export builders ─────────────────────────────── */
import { addDays, differenceInDays, format } from "date-fns";
import type { Project } from "@/lib/api-client";

export function projectsToCSVRows(projects: Project[]) {
  return projects.map(p => {
    const phases = p.phases ?? [];
    const completedPhases = phases.filter(ph => ph.status === "completed").length;
    const progress = phases.length ? Math.round(completedPhases / phases.length * 100) : 0;
    const startDate = p.start_date ?? p.created_at;
    const daysLeft = differenceInDays(addDays(new Date(startDate), p.timebox_days), new Date());
    return {
      ID: p.id,
      Title: p.title,
      Type: p.type,
      Status: p.status,
      Priority: p.priority,
      "Start Date": p.start_date ?? "",
      "Timebox (days)": p.timebox_days,
      "Days Remaining": daysLeft,
      "Phase Progress %": progress,
      "Total Tasks": p.task_count ?? 0,
      "Completed Tasks": p.completed_tasks ?? 0,
      "Team Size": (p.assignees ?? []).length,
      "Current Phase": p.current_phase ?? "",
    };
  });
}

export function teamToCSVRows(users: { id: string; name: string; role: string; department: string; email: string }[]) {
  return users.map(u => ({
    ID: u.id,
    Name: u.name,
    Role: u.role,
    Department: u.department,
    Email: u.email,
  }));
}
