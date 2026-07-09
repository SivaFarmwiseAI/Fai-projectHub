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

/** Competencies a peer reviewer rated (1–5) — legacy shape, kept so older submitted reviews still render. */
export const PEER_COMPETENCIES: { key: string; label: string; hint: string }[] = [
  { key: "quality", label: "Quality of work", hint: "Accurate, high-standard, dependable output." },
  { key: "collaboration", label: "Collaboration & teamwork", hint: "Works well with others; shares knowledge." },
  { key: "ownership", label: "Ownership & reliability", hint: "Takes responsibility and follows through." },
  { key: "communication", label: "Communication", hint: "Clear, timely and constructive." },
  { key: "impact", label: "Impact & outcomes", hint: "Drives results that matter to the team." },
];

/**
 * Peer-review questionnaire. Every question requires a written answer;
 * the one marked `scale: true` additionally carries a required 1–5 rating
 * that becomes the review's total score.
 */
export const PEER_QUESTIONS: { key: string; short: string; question: string; placeholder: string; scale?: boolean }[] = [
  {
    key: "conduct",
    short: "Workplace conduct",
    question: "How would you rate the employee's behavior, attitude, professionalism, and overall conduct in the workplace?",
    placeholder: "Describe their day-to-day behavior, attitude and professionalism…",
  },
  {
    key: "collaboration",
    short: "Collaboration & communication",
    question: "How effectively does the employee collaborate and communicate with team members and stakeholders while handling teamwork, feedback, coordination, conflict resolution, and challenging situations?",
    placeholder: "How do they handle teamwork, feedback, coordination and difficult situations?",
  },
  {
    key: "contribution",
    short: "Contribution beyond own work",
    question: "Can you share a specific example where this person actively contributed to the team's success beyond their own assigned work?",
    placeholder: "One concrete example — what they did, and the impact it had…",
  },
  {
    key: "strength",
    short: "Standout strength",
    question: "What is one quality or strength you personally appreciate in this person that others could learn from? Be specific about why you value it.",
    placeholder: "Name the quality and explain why you value it…",
  },
  {
    key: "improvement",
    short: "Areas to improve",
    question: "Are there any areas where this person could further improve from teamwork, communication, or behavioral perspective?",
    placeholder: "Be specific and constructive — what could they do differently?",
  },
  {
    key: "overall",
    short: "Overall rating",
    question: "On a scale of 1 to 5, how would you rate this person's overall teamwork, collaboration, and workplace conduct? Provide a brief justification.",
    placeholder: "Briefly justify the rating you chose…",
    scale: true,
  },
];

/** Labels for the 1–5 overall scale (index 0 → rating 1). */
export const PEER_SCALE_LABELS = ["Not satisfactory", "Below expectation", "Meets expectation", "Exceeds expectation", "Exceptional"];

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
