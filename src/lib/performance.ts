/**
 * Shared display helpers for the Performance Assessment (360°) module.
 * Keeps rating-band colours, role/level labels and the peer-review competency
 * set consistent across the analysis, team, report and review components.
 */

export const BAND_COLOR: Record<string, string> = {
  "Exceptional": "#059669",
  "Exceeds Expectation": "#16a34a",
  "Meets Expectation": "#f59e0b",
  "Below Expectation": "#f97316",
  "Not Satisfactory": "#ef4444",
  "Unrated": "#94a3b8",
};

export const ROLE_LABEL: Record<string, string> = {
  eng: "Engineering / Development",
  ds: "Data Science / AI",
  sales: "Sales / Business Development",
  ba: "Product / Business Analysis",
  delivery: "Delivery / Project Management",
  client: "Client Engagement / Management",
};

export const LEVEL_LABEL: Record<string, string> = {
  junior: "Fresher / Junior",
  mid: "Mid-level",
  senior: "Senior / Lead",
};

const LN = ["Exceptional", "Exceeds", "Meets", "Below", "Unsatisfactory"];
const NUM = [5, 4, 3, 2, 1];

const CATS = [
  { min: 4.5, name: "Exceptional" },
  { min: 3.5, name: "Exceeds Expectation" },
  { min: 2.5, name: "Meets Expectation" },
  { min: 1.5, name: "Below Expectation" },
  { min: 0, name: "Not Satisfactory" },
];

/** Competencies a peer reviewer rates (1–5). */
export const PEER_COMPETENCIES: { key: string; label: string; hint: string }[] = [
  { key: "quality", label: "Quality of work", hint: "Accurate, high-standard, dependable output." },
  { key: "collaboration", label: "Collaboration & teamwork", hint: "Works well with others; shares knowledge." },
  { key: "ownership", label: "Ownership & reliability", hint: "Takes responsibility and follows through." },
  { key: "communication", label: "Communication", hint: "Clear, timely and constructive." },
  { key: "impact", label: "Impact & outcomes", hint: "Drives results that matter to the team." },
];

export const bandColor = (band?: string | null) => (band && BAND_COLOR[band]) || "#94a3b8";
export const roleLabel = (k: string) => ROLE_LABEL[k] ?? k;
export const levelLabel = (k?: string) => (k ? LEVEL_LABEL[k] ?? k : "—");
export const fmtScore = (n?: number | null) => (n == null ? "—" : Number(n).toFixed(2));

export const ratingLabel = (n: number | null | undefined) =>
  n == null ? "—" : `${LN[NUM.indexOf(n)] ?? n} (${n})`;

/** Map a 0–5 score to its rating band. */
export function bandForScore(v: number): string {
  for (const c of CATS) if (v >= c.min) return c.name;
  return "Not Satisfactory";
}

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return s;
  }
}
