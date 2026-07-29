/**
 * Shared display helpers for the Performance Assessment (360°) module.
 * Keeps rating-band colours, role/level labels and the peer-review competency
 * set consistent across the analysis, team, report and review components.
 */

export const BAND_COLOR: Record<string, string> = {
  Exceptional: "#059669",
  "Exceeds Expectation": "#16a34a",
  "Meets Expectation": "#f59e0b",
  "Below Expectation": "#f97316",
  "Not Satisfactory": "#ef4444",
  Unrated: "#94a3b8",
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
export const PEER_COMPETENCIES: { key: string; label: string; hint: string }[] =
  [
    {
      key: "quality",
      label: "Quality of work",
      hint: "Accurate, high-standard, dependable output.",
    },
    {
      key: "collaboration",
      label: "Collaboration & teamwork",
      hint: "Works well with others; shares knowledge.",
    },
    {
      key: "ownership",
      label: "Ownership & reliability",
      hint: "Takes responsibility and follows through.",
    },
    {
      key: "communication",
      label: "Communication",
      hint: "Clear, timely and constructive.",
    },
    {
      key: "impact",
      label: "Impact & outcomes",
      hint: "Drives results that matter to the team.",
    },
  ];

/**
 * Peer-review questionnaire. Every question requires a written answer;
 * the one marked `scale: true` additionally carries a required 1–5 rating
 * that becomes the review's total score.
 */
export const PEER_QUESTIONS: {
  key: string;
  short: string;
  question: string;
  placeholder: string;
  scale?: boolean;
}[] = [
  {
    key: "conduct",
    short: "Workplace conduct",
    question:
      "How would you rate the employee's behavior, attitude, professionalism, and overall conduct in the workplace?",
    placeholder:
      "Describe their day-to-day behavior, attitude and professionalism…",
  },
  {
    key: "collaboration",
    short: "Collaboration & communication",
    question:
      "How effectively does the employee collaborate and communicate with team members and stakeholders while handling teamwork, feedback, coordination, conflict resolution, and challenging situations?",
    placeholder:
      "How do they handle teamwork, feedback, coordination and difficult situations?",
  },
  {
    key: "contribution",
    short: "Contribution beyond own work",
    question:
      "Can you share a specific example where this person actively contributed to the team's success beyond their own assigned work?",
    placeholder: "One concrete example — what they did, and the impact it had…",
  },
  {
    key: "strength",
    short: "Standout strength",
    question:
      "What is one quality or strength you personally appreciate in this person that others could learn from? Be specific about why you value it.",
    placeholder: "Name the quality and explain why you value it…",
  },
  {
    key: "improvement",
    short: "Areas to improve",
    question:
      "Are there any areas where this person could further improve from teamwork, communication, or behavioral perspective?",
    placeholder:
      "Be specific and constructive — what could they do differently?",
  },
  {
    key: "overall",
    short: "Overall rating",
    question:
      "On a scale of 1 to 5, how would you rate this person's overall teamwork, collaboration, and workplace conduct? Provide a brief justification.",
    placeholder: "Briefly justify the rating you chose…",
    scale: true,
  },
];

/** Labels for the 1–5 overall scale (index 0 → rating 1). */
export const PEER_SCALE_LABELS = [
  "Not satisfactory",
  "Below expectation",
  "Meets expectation",
  "Exceeds expectation",
  "Exceptional",
];

/** Behavioural parameters the manager rates 1–5 inside the `grid` question. */
export const MANAGER_PARAMETERS: { key: string; label: string }[] = [
  { key: "discipline", label: "Discipline and punctuality" },
  { key: "policy", label: "Policy and process adherence" },
  { key: "ethics", label: "Professional conduct and ethics" },
  { key: "teamwork", label: "Team behaviour and collaboration" },
  { key: "accountability", label: "Accountability and reliability" },
];

/** Behaviours the manager can flag in the Culture & Integrity Gate question. */
export const GATE_FLAGS = [
  "Shared confidential info",
  "Internal politics",
  "Gossip / rumours",
  "Misrepresentation of work",
  "Repeated attendance issues",
  "Lack of accountability",
  "Disrespectful behaviour",
  "Harmed team morale",
  "Policy violation",
];

/** Severity choices for the Culture & Integrity Gate question. */
export const GATE_SEVERITIES: {
  key: "none" | "concern" | "serious";
  label: string;
}[] = [
  { key: "none", label: "None" },
  { key: "concern", label: "Concern noted" },
  { key: "serious", label: "Serious (cap)" },
];

const BAND_ORDER = [
  "Exceptional",
  "Exceeds Expectation",
  "Meets Expectation",
  "Below Expectation",
  "Not Satisfactory",
];

/** Integrity-gate cap: drop a band one step (Exceptional → Exceeds · Exceeds → Meets · Meets → Below). */
export function capOneBand(band: string): string {
  const i = BAND_ORDER.indexOf(band);
  return i >= 0 && i < 3 ? BAND_ORDER[i + 1] : band;
}

/**
 * Manager (authoritative) review questionnaire. Every question requires BOTH a
 * 1–5 rating and a written answer. The `grid` question swaps the single scale
 * for the MANAGER_PARAMETERS grid (each parameter rated 1–5). The `gate`
 * question swaps it for the Culture & Integrity Gate (GATE_FLAGS + severity;
 * a serious concern caps the final band one step). The `overall` question's
 * rating becomes the review's total score.
 */
export const MANAGER_QUESTIONS: {
  key: string;
  short: string;
  question: string;
  placeholder: string;
  grid?: boolean;
  gate?: boolean;
  overall?: boolean;
}[] = [
  {
    key: "selfappraisal",
    short: "Self-appraisal accuracy",
    question:
      "How accurately does this employee's self-appraisal reflect their actual performance during the year? Is their self-assessment overestimated, broadly aligned, or underestimated — and what is your reasoning?",
    placeholder:
      "Overestimated, broadly aligned, or underestimated — and your reasoning…",
  },
  {
    key: "impact",
    short: "Business impact",
    question:
      "Based on the employee's achievements and contributions this year, what business impact have they had on the project, team, or organization? Add your managerial perspective beyond what the employee has stated.",
    placeholder:
      "Impact on project, team or organisation — beyond what the employee stated…",
  },
  {
    key: "growth",
    short: "Professional growth",
    question:
      "How would you evaluate this employee's professional growth and development over the past year? Cover technical skills, domain knowledge, communication, leadership, and any additional responsibilities taken on.",
    placeholder:
      "Technical skills, domain knowledge, communication, leadership, new responsibilities…",
  },
  {
    key: "workstyle",
    short: "Working style & ownership",
    question:
      "How would you assess this employee's working style — specifically their commitment, initiative, and ability to manage competing priorities without close supervision? Focus on how they worked, not just what they delivered.",
    placeholder:
      "Commitment, initiative, handling competing priorities without supervision…",
  },
  {
    key: "beyond",
    short: "Beyond core responsibilities",
    question:
      "How has this employee contributed beyond their core responsibilities towards team or organizational development? Highlight the tangible impact of these efforts.",
    placeholder:
      "Mentoring, hiring, process improvements, culture — and their tangible impact…",
  },
  {
    key: "strengths",
    short: "Key strengths & value",
    question:
      "What key strengths does this employee bring to the team, and how do those strengths add specific value to the project and make them valuable for this organization?",
    placeholder:
      "The strengths, and the specific value they add to project and organisation…",
  },
  {
    key: "readiness",
    short: "Readiness for larger role",
    question:
      "How ready is this employee for greater responsibility within the next 12 months? Identify the strengths supporting this, the gaps to address, and the development actions you would recommend.",
    placeholder:
      "Supporting strengths, gaps to close, and recommended development actions…",
  },
  {
    key: "parameters",
    short: "Behavioural parameters",
    question:
      "Rate the employee on the following parameters on a scale of 1 to 5.",
    placeholder: "Context or examples behind these parameter ratings…",
    grid: true,
  },
  {
    key: "integrity",
    short: "Culture & integrity gate",
    question:
      "Have you observed any culture or integrity concerns with this employee during the year — confidentiality, internal politics, gossip, misrepresentation of work, repeated attendance issues, accountability, respect, or policy? Flag anything that applies and mark how serious it is. A serious concern caps the final rating one band lower.",
    placeholder:
      "Context behind any flags raised — or note that there were no concerns…",
    gate: true,
  },
  {
    key: "overall",
    short: "Overall rating & summary",
    question:
      "Overall, how would you rate this employee's performance and contribution during this appraisal year? Provide a summary covering delivery, growth, conduct, and business impact that can be shared with the employee during the appraisal discussion.",
    placeholder:
      "Appraisal summary — delivery, growth, conduct, business impact…",
    overall: true,
  },
];

export const bandColor = (band?: string | null) =>
  (band && BAND_COLOR[band]) || "#94a3b8";
export const roleLabel = (k: string) => ROLE_LABEL[k] ?? k;
export const levelLabel = (k?: string) => (k ? (LEVEL_LABEL[k] ?? k) : "—");
export const fmtScore = (n?: number | null) =>
  n == null ? "—" : Number(n).toFixed(2);

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
    return new Date(s).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

/* ── Assessment data shapes (mirror gather() in the assessment page) ──
   Shared by the on-screen report modal and the print document builder. */

export interface Contribution {
  id?: number;
  title?: string;
  area?: string;
  context?: string;
  problem?: string;
  create?: string;
  adopt?: string;
  changed?: string;
  value?: string;
  sustain?: string;
  evidence?: string;
  proofref?: string;
  prooffilename?: string;
  /** Public URL of the uploaded proof file; legacy submissions have only the name. */
  proofurl?: string;
  rjust?: string;
  custom?: { q?: string; a?: string }[];
  self?: number | null;
  reviewer?: number | null;
  impacts?: string[];
  impactWhy?: Record<string, string>;
  flagged?: boolean;
}

export interface Entry {
  id?: number;
  rating?: number | null;
  text?: string;
  remark?: string;
}

export interface PeerData {
  answers?: Record<string, string>;
  overall?: number | null;
  /** Manager-review shape: per-question rating + narrative, behavioural grid. */
  managerAnswers?: Record<string, { rating?: number; text?: string }>;
  parameters?: Record<string, number>;
  /** Culture & Integrity Gate (manager review): flagged behaviours + severity. */
  gateFlags?: string[];
  severity?: string;
  /** Legacy shape from the old competency-based form. */
  competencies?: Record<string, number>;
  strengths?: string;
  improvements?: string;
  comment?: string;
}

export interface AssessmentData {
  contributions?: Contribution[];
  teamEntries?: Entry[];
  orgEntries?: Entry[];
  cultRatings?: Record<string, number>;
  cultComment?: string;
  gateFlags?: string[];
  level?: string;
  facets?: string[];
}

/** Impact-type labels for individual contributions. */
export const IMPACT_LABELS: Record<string, string> = {
  reusable: "Reusable asset / component",
  time: "Time / effort saved",
  quality: "Better quality / fewer errors",
  smarter: "Did it a smarter / different way",
  learning: "Learned & applied a new skill",
  adoption: "Adoption / usage",
  capability: "New capability built",
  cost: "Cost reduction",
  revenue: "Direct revenue",
  strategic: "Strategic (new geography / dept / market)",
  customer: "Customer impact",
  team: "Team multiplication",
};

/** Culture & values self-rating items (key + label). */
export const CULT_ITEMS: [string, string][] = [
  ["punct", "Punctuality — arrives on time"],
  ["attend", "Attendance & regularity"],
  ["deliver", "Delivers on time / meets commitments"],
  ["team", "Team-friendly & respectful"],
  ["conduct", "Professional conduct & confidentiality"],
  ["commit", "Commitment & ownership"],
  ["hours", "Manages workload within working hours"],
];

/** Numeric 1–5 rating → short label. */
export const RATING_LABELS: Record<number, string> = {
  5: "Exceptional",
  4: "Exceeds",
  3: "Meets",
  2: "Below",
  1: "Unsatisfactory",
};
