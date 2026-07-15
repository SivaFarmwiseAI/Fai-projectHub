"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  Fragment,
} from "react";
import {
  Award,
  BarChart3,
  ClipboardList,
  Inbox,
  Users2,
  CalendarRange,
  Network,
  Search,
  Check,
  Upload,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  performanceAssessments,
  users as usersApi,
  uploads,
  ApiError,
  type ReviewCycle,
  type User,
  type PerformanceAssessmentRow,
} from "@/lib/api-client";
import { PerformanceAnalysis } from "@/components/performance-analysis";
import { PerformanceReviews } from "@/components/performance-reviews";
import { PerformanceTeam } from "@/components/performance-team";
import { PerformanceCycles } from "@/components/performance-cycles";
import { OrgTreeEditor } from "@/components/org-tree-editor";

type PerfView = "self" | "reviews" | "team" | "analysis" | "cycles" | "org";

// ── Types ────────────────────────────────────────────────────────────────────
interface Contribution {
  id: number;
  self: number | null;
  reviewer: number | null;
  impacts: string[];
  impactWhy: Record<string, string>;
  flagged?: boolean;
  title: string;
  area: string;
  context: string;
  problem: string;
  create: string;
  adopt: string;
  changed: string;
  value: string;
  sustain: string;
  evidence: string;
  proofref: string;
  prooffilename: string;
  /** Public CloudFront URL of the uploaded proof file (empty for link-only or
   *  legacy submissions that stored just the file name). */
  proofurl: string;
  rjust: string;
  custom: { q: string; a: string }[];
}

/** A blank Individual Contribution. One exists by default; users add more via
 *  "+ Add a contribution". */
function blankContrib(id: number): Contribution {
  return {
    id,
    self: null,
    reviewer: null,
    impacts: [],
    impactWhy: {},
    title: "",
    area: "",
    context: "",
    problem: "",
    create: "",
    adopt: "",
    changed: "",
    value: "",
    sustain: "",
    evidence: "",
    proofref: "",
    prooffilename: "",
    proofurl: "",
    rjust: "",
    custom: [],
  };
}

/** Proof uploads: same cap as project attachments (Lambda base64 path). */
const PROOF_MAX_BYTES = 8 * 1024 * 1024;
const PROOF_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.svg,.webp,.zip";

interface Entry {
  id: number;
  rating: number | null;
  text: string;
  remark: string;
}

/** A blank Team/Organization contribution row. One exists by default; users add
 *  more via "+ Add a … contribution". */
function blankEntry(id: number): Entry {
  return { id, rating: null, text: "", remark: "" };
}

interface SubmitStepError {
  step: number;
  stepLabel: string;
  topMsg: string;
  topShortLabel: string;
  fields: { key: string; label: string; shortLabel: string }[];
  errs: Record<string, string>;
}

// ── Constants ────────────────────────────────────────────────────────────────
const STEPS = [
  "Philosophy",
  "About You",
  "Contributions",
  "Team",
  "Organization",
  "Culture",
  "Review & Submit",
];

const CATS = [
  { min: 4.5, name: "Exceptional", color: "#059669" },
  { min: 3.5, name: "Exceeds Expectation", color: "#16a34a" },
  { min: 2.5, name: "Meets Expectation", color: "#f59e0b" },
  { min: 1.5, name: "Below Expectation", color: "#f97316" },
  { min: 0, name: "Not Satisfactory", color: "#ef4444" },
];

const LN = ["Exceptional", "Exceeds", "Meets", "Below", "Unsatisfactory"];
const NUM = [5, 4, 3, 2, 1];

const FACETS: Record<string, { label: string; hint: string }> = {
  eng: {
    label: "Engineering / Development",
    hint: "Production-ready delivery, reduced delivery time, fewer defects, reusable components adopted by other projects, or a new technical capability.",
  },
  ds: {
    label: "Data Science / AI",
    hint: "Improved accuracy/speed, reduced processing cost, a novel or reusable model, or a new AI capability used in production.",
  },
  sales: {
    label: "Sales / Business Development",
    hint: "Revenue won, strategic clients converted, a new state/department opened, or a repeat-revenue stream.",
  },
  ba: {
    label: "Product / Business Analysis",
    hint: "Reduced rework, a feature that became a differentiator, improved customer outcomes, or a process/feature that was adopted.",
  },
  delivery: {
    label: "Delivery / Project Management",
    hint: "On-time, high-quality delivery, fewer delays/escalations, better delivery predictability, or stronger client confidence.",
  },
  client: {
    label: "Client Engagement / Management",
    hint: "Stronger relationships, new opportunities created, higher satisfaction, or expansion enabled.",
  },
};

const RATE_DESC = [
  "New capability / USP, significant revenue-time-cost impact, widely adopted. Requires full proof.",
  "Clearly beyond the brief; adopted; measurable improvement.",
  "Delivered on time, good quality, used/adopted as expected, minimal supervision.",
  "Incomplete, not adopted, or needed rework.",
  "No usable outcome.",
];

const IMPACTS: [string, string][] = [
  ["reusable", "Reusable asset / component"],
  ["time", "Time / effort saved"],
  ["quality", "Better quality / fewer errors"],
  ["smarter", "Did it a smarter / different way"],
  ["learning", "Learned & applied a new skill"],
  ["adoption", "Adoption / usage"],
  ["capability", "New capability built"],
  ["cost", "Cost reduction"],
  ["revenue", "Direct revenue"],
  ["strategic", "Strategic (new geography / dept / market)"],
  ["customer", "Customer impact"],
  ["team", "Team multiplication"],
];

const HIGH_BY_LEVEL: Record<string, string[]> = {
  junior: ["reusable", "time", "quality", "smarter", "capability", "adoption"],
  mid: [
    "reusable",
    "time",
    "cost",
    "capability",
    "adoption",
    "revenue",
    "strategic",
  ],
  senior: ["revenue", "capability", "strategic"],
};

const IMPACT_EG: Record<string, string> = {
  reusable: "e.g. packaged as a shared component, reused in 4 projects",
  time: "e.g. saved ~6 hrs per cycle / ~400 hrs a year",
  quality: "e.g. defects down 70% / zero production bugs",
  smarter: "e.g. automated a manual step / a simpler, cleaner approach",
  learning: "e.g. learned X and applied it to ship Y faster",
  adoption: "e.g. used by 20 engineers across 4 projects",
  capability: "e.g. first OCR engine / a new GeoAI workflow",
  cost: "e.g. cut cloud cost by ₹10L a year",
  revenue: "e.g. enabled a ₹5 Cr deal / influenced renewal",
  strategic: "e.g. opened Telangana / a new department or market",
  customer: "e.g. fewer complaints / higher satisfaction / better uptime",
  team: "e.g. automation used by 15 people / mentored 3 juniors",
};

const LEVEL_HINT: Record<string, string> = {
  junior:
    "You're assessed on value <b>within your scope</b> — a reusable component, a smarter approach, time/effort saved, fewer errors, or something learned and applied. You do <b>not</b> need company-wide revenue to score well.",
  mid: "Show outcomes beyond just delivery — improvements, reusable assets, efficiency gains, and work adopted by other projects or teams, ideally with numbers.",
  senior:
    "Show broader impact — revenue, new capability, strategic moves (new geography / department / market), and org-wide adoption, backed by measurable proof.",
};

const CULT_ITEMS: [string, string][] = [
  ["punct", "Punctuality — arrives on time"],
  ["attend", "Attendance & regularity"],
  ["deliver", "Delivers on time / meets commitments"],
  ["team", "Team-friendly & respectful"],
  ["conduct", "Professional conduct & confidentiality"],
  ["commit", "Commitment & ownership"],
  ["hours", "Manages workload within working hours"],
];

const SCALE5 = [
  "5 — Outstanding",
  "4 — Strong",
  "3 — Good / as expected",
  "2 — Inconsistent",
  "1 — Poor",
];
const W = { ind: 60, team: 20, org: 10, culture: 10 };
const DRAFT_KEY = "fw_assessment_draft_v2";
const INJECT =
  /(ignore (all |the )?(previous|above|prior)|disregard|as an ai|you (must|should|need to|have to) (rate|give|score|mark|assign)|please (rate|give|score|mark)|rate (this|me|it)|give (me |it |this )?(a |an )?(5|4|five|four|exceptional|exceeds)|exceptional rating|highest (rating|score)|override|system\s*:|assistant\s*:|prompt|instruction)/i;

function catIndexOf(v: number) {
  for (let i = 0; i < CATS.length; i++) if (v >= CATS[i].min) return i;
  return 4;
}

// ── Scoped CSS — aligned to the ProjectHub design system ─────────────────────
// Inherits Plus Jakarta Sans from the app; uses the slate + blue/indigo palette,
// rounded-2xl cards, shadow-card elevation and the gradient/accent treatments
// shared across the rest of the application.
const PA_CSS = `
.pa{--green:#16a34a;--orange:#f59e0b;--red:#ef4444;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc;--card:#fff;--accent:#3b82f6;--accent-soft:#eff6ff;--leaf:#4f46e5;--leaf-soft:#eef2ff;color:var(--ink);line-height:1.55}
.pa *{box-sizing:border-box}
/* step nav — white app-style bar, blue→indigo active pill */
.pa .stepnav{background:rgba(255,255,255,.92);backdrop-filter:blur(12px) saturate(160%);-webkit-backdrop-filter:blur(12px) saturate(160%);border:1px solid rgba(0,0,0,.06);border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.05);margin-bottom:16px}
.pa .stepnav-inner{display:flex;overflow-x:auto;padding:8px;gap:4px;scrollbar-width:none}
.pa .stepnav-inner::-webkit-scrollbar{display:none}
.pa .sn{display:flex;align-items:center;gap:7px;padding:8px 12px;color:#64748b;font-size:12.5px;font-weight:600;cursor:pointer;border-radius:10px;white-space:nowrap;flex-shrink:0;transition:all .18s cubic-bezier(.16,1,.3,1)}
.pa .sn:hover{background:#f1f5f9;color:#334155}
.pa .sn .snum{width:20px;height:20px;border-radius:50%;background:#e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;flex:0 0 auto;transition:all .18s}
.pa .sn.active{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 2px 12px rgba(59,130,246,.4),inset 0 1px 0 rgba(255,255,255,.15)}
.pa .sn.active .snum{background:rgba(255,255,255,.28);color:#fff}
.pa .sn.done{color:#4f46e5}
.pa .sn.done .snum{background:#4f46e5;color:#fff}
.pa .sn.locked{opacity:.4;cursor:not-allowed;pointer-events:none}
/* content */
.pa .wrap{max-width:1440px;margin:0 auto;width:100%}
.pa .card{background:var(--card);border:1px solid rgba(0,0,0,.06);border-radius:18px;padding:28px 32px;margin-bottom:18px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.05),0 0 0 1px rgba(0,0,0,.03)}
.pa h2{font-size:19px;font-weight:800;letter-spacing:-.02em;margin:0 0 12px;color:var(--ink)}
.pa h3.sec{font-size:13px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;margin:22px 0 10px;color:var(--leaf);border-bottom:1px solid var(--leaf-soft);padding-bottom:6px}
.pa p{margin:0 0 10px}
.pa .lead{font-size:15px}
.pa ul{margin:6px 0 14px;padding-left:22px}.pa li{margin:3px 0}
.pa .pill-list{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 14px}
.pa .pill-list li{background:var(--leaf-soft);color:var(--leaf);font-weight:600;font-size:13px;padding:5px 12px;border-radius:9999px;margin:0}
.pa .opening{background:linear-gradient(135deg,#eff6ff,#eef2ff);border:1px solid #dbeafe;border-left:3px solid var(--accent);border-radius:0 14px 14px 0;padding:16px 20px;margin:6px 0}
.pa .opening .big{font-size:16px;font-weight:800;letter-spacing:-.01em;color:#1e3a8a}
.pa .formula{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;border-radius:14px;padding:18px 20px;text-align:center;font-size:18px;font-weight:800;letter-spacing:.3px;margin:14px 0;box-shadow:0 4px 20px rgba(59,130,246,.18)}
.pa .formula small{display:block;font-weight:500;font-size:12.5px;opacity:.9;margin-top:6px;letter-spacing:0}
.pa .gb{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0 20px}
.pa .ex{border-radius:14px;padding:18px 20px;font-size:13.5px;line-height:1.65}
.pa .ex .tag{display:block;width:fit-content;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 10px;border-radius:9999px;margin-bottom:10px}
.pa .bad{background:#fef2f2;border:1px solid #fecaca}.pa .bad .tag{background:var(--red);color:#fff}
.pa .good{background:#f0fdf4;border:1px solid #bbf7d0}.pa .good .tag{background:var(--green);color:#fff}
.pa .hier{border-left:3px solid var(--accent);background:#f8fafc;border-radius:0 12px 12px 0;padding:12px 16px;margin:8px 0;font-size:13px}
.pa .hier h4{margin:0 0 4px;font-size:13.5px;font-weight:700}.pa .hier .q{font-style:italic;color:var(--muted);font-size:12.5px;margin:2px 0 6px}
.pa .hier .lv{font-size:12px;font-weight:800;color:var(--accent);letter-spacing:.06em;text-transform:uppercase}
.pa table.matrix{width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:13px}
.pa table.matrix th,.pa table.matrix td{border:1px solid var(--line);padding:9px 12px;text-align:left}
.pa table.matrix th{background:var(--leaf-soft);color:var(--leaf);font-weight:700}
.pa table.matrix td.m{color:var(--red);font-weight:700}.pa table.matrix td.p{color:var(--muted);font-weight:600}
.pa .tmpl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0 14px}
.pa .tmpl div{background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:11px 13px;font-size:13px}.pa .tmpl b{color:var(--accent)}
.pa .ack{background:var(--leaf-soft);border:1px dashed #c7d2fe;border-radius:16px;padding:18px}
.pa .ack label{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin-bottom:12px;cursor:pointer}
.pa .ack input[type=checkbox]{width:18px;height:18px;margin-top:2px;flex:0 0 auto;cursor:pointer;accent-color:#4f46e5}
.pa .grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.pa .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pa label.fld{display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
.pa input:not([type=checkbox]):not([type=file]),.pa select,.pa textarea{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:10px;font-size:14px;background:#fff;color:var(--ink);font-family:inherit;transition:box-shadow .2s ease,border-color .2s ease}
.pa input:not([type=checkbox]):not([type=file]):focus,.pa select:focus,.pa textarea:focus{outline:none;border-color:rgba(59,130,246,.55);box-shadow:0 0 0 3px rgba(59,130,246,.14)}
.pa textarea{resize:vertical;min-height:54px}
/* Custom, consistently-placed dropdown chevron (replaces the inconsistent
   native select arrow). Pinned 12px from the right edge across all browsers. */
.pa select{appearance:none;-webkit-appearance:none;-moz-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;background-size:14px;padding-right:34px}
/* Only while the dropdown picker is actually OPEN, flip the chevron up and tint
   it the accent. The :open pseudo-class (unlike :focus) clears as soon as the
   list closes, so the arrow doesn't stay stuck up after selecting. */
.pa select:open{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 15l6-6 6 6'/%3E%3C/svg%3E")}
/* File upload — a styled label-button wrapping a visually-hidden native input.
   Native file inputs render inconsistently (and the button is invisible here
   because the rule above excludes [type=file]); this gives a consistent,
   accessible "Choose File" button across all browsers. */
.pa .custom-q-row{display:flex;align-items:center;gap:8px}
.pa .custom-q-row input{flex:1}
.pa .custom-remove{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:1px solid #fecaca;border-radius:9px;background:#fef2f2;color:var(--red);cursor:pointer;transition:border-color .18s ease,background .18s ease,color .18s ease}
.pa .custom-remove:hover{border-color:var(--red);background:var(--red);color:#fff}
.pa .proof-row{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}
.pa .or-sep{font-size:12.5px;font-weight:600;color:var(--muted);flex:0 0 auto;padding-bottom:10px}
.pa .file-row{display:flex;align-items:center;gap:10px}
.pa label.file-btn{display:inline-flex;flex-direction:row;align-items:center;gap:7px;margin-bottom:0;padding:9px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex:0 0 auto;transition:box-shadow .2s ease,border-color .2s ease,background .2s ease}
.pa label.file-btn:hover{border-color:rgba(59,130,246,.55);background:var(--accent-soft)}
.pa label.file-btn:focus-within{outline:none;border-color:rgba(59,130,246,.55);box-shadow:0 0 0 3px rgba(59,130,246,.14)}
.pa .file-btn svg{flex:0 0 auto}
.pa .file-btn input[type=file]{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pa .file-name{font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.pa input[type=file]{font-size:13px;padding:6px}
.pa .hint{font-size:12.5px;color:var(--muted);margin:0 0 10px}
.pa .facets{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0}
.pa .facet{border:1px solid var(--line);border-radius:14px;padding:12px 14px;cursor:pointer;font-size:13px;width:calc(50% - 5px);transition:all .18s cubic-bezier(.16,1,.3,1)}
.pa .facet:hover{border-color:#c7d2fe;background:#fafbff}.pa .facet.on{border-color:var(--leaf);background:var(--leaf-soft);box-shadow:0 0 0 1px var(--leaf)}
.pa .facet b{display:block;margin-bottom:3px;font-size:13px;font-weight:700}.pa .facet span{color:var(--muted);font-size:13px}
.pa .rate{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:8px 0}
.pa .rb{border:1px solid var(--line);border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted);transition:all .14s cubic-bezier(.16,1,.3,1)}
.pa .rb:hover{border-color:#bfdbfe;background:#f8fafc}.pa .rb.sel{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.pa .rb b{display:block;font-size:15px;font-weight:800;margin-bottom:2px;color:inherit}
.pa .contrib{border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:22px 24px;margin-bottom:18px;background:#f8fafc}
.pa .contrib .ch{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.pa .contrib .ch h4{margin:0;font-size:14px;font-weight:700;color:var(--leaf)}
.pa .rm{background:#fef2f2;color:var(--red);border:1px solid #fecaca;border-radius:9px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;transition:background .15s}
.pa .rm:hover{background:#fee2e2}
.pa .field{margin-bottom:14px}
.pa .field label{display:block;font-size:13px;font-weight:600;margin-bottom:5px;color:#334155}
.pa .block{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 14px}
.pa .block.alt{background:#fafbff;border-color:#e0e7ff}
.pa .block:last-child{margin-bottom:0}
.pa .blockh{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--leaf);margin:0 0 12px;padding-bottom:9px;border-bottom:1px solid var(--line)}
.pa .blockh .stepn{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:0 0 auto}
.pa .addbtn{background:var(--leaf-soft);color:var(--leaf);border:1px dashed #c7d2fe;border-radius:14px;padding:13px;width:100%;font-size:14px;cursor:pointer;font-weight:700;margin-top:4px;transition:all .18s}
.pa .addbtn:hover{background:#e0e7ff;border-color:var(--leaf)}
.pa .toggle{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#f1f5f9;padding:3px;gap:3px}
.pa .toggle button{border-radius:7px;background:transparent;color:var(--muted);padding:7px 15px;font-size:13.5px;cursor:pointer;border:none;font-weight:600;transition:all .15s}
.pa .toggle button.on{background:#fff;color:var(--accent);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.pa button{border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s cubic-bezier(.16,1,.3,1)}
.pa button:disabled{opacity:.4;cursor:not-allowed}
.pa .primary{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 0 0 1px rgba(59,130,246,.12),0 4px 20px rgba(59,130,246,.18)}
.pa .primary:hover:not(:disabled){background:linear-gradient(135deg,#2563eb,#4f46e5);box-shadow:0 4px 20px rgba(59,130,246,.45);transform:translateY(-1px)}
.pa .accent-btn{background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;box-shadow:0 0 0 1px rgba(59,130,246,.12),0 4px 20px rgba(59,130,246,.18)}
.pa .accent-btn:hover:not(:disabled){transform:translateY(-1px)}
.pa .ghost{background:#fff;border:1px solid var(--line);color:#334155}
.pa .ghost:hover{background:#f8fafc;border-color:#cbd5e1}
.pa .navbtns{display:flex;justify-content:space-between;align-items:center;margin-top:4px;gap:10px;flex-wrap:wrap}
.pa .sugg{font-size:13px}
.pa .suggn{display:inline-block;color:#fff;font-weight:700;font-size:12px;padding:3px 11px;border-radius:9999px;margin-right:6px}
.pa .tags{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.pa .tag2{display:inline-block;border:1px solid var(--line);border-radius:9999px;padding:5px 13px;font-size:12.5px;cursor:pointer;user-select:none;background:#fff;transition:all .14s}
.pa .tag2:hover{border-color:#bfdbfe}.pa .tag2.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.pa .impwhy .row{display:flex;align-items:center;gap:10px;margin-bottom:7px}
.pa .impwhy .lbl{flex:0 0 180px;font-size:12.5px;font-weight:600;color:var(--accent)}
.pa .impwhy .row input{flex:1}
.pa .scorebar{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.pa .bignum{font-size:42px;font-weight:800;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.pa .cat{font-size:17px;font-weight:800;padding:7px 18px;border-radius:9999px;color:#fff}
.pa .breakdown{font-size:13px;color:var(--muted)}.pa .breakdown b{color:var(--ink)}
.pa .map-row{display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0}.pa .dot{width:12px;height:12px;border-radius:50%;flex:0 0 auto}
.pa .draftbar{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13.5px}
.pa .rev-block{border:1px solid var(--line);border-radius:14px;padding:15px;margin-bottom:12px}
.pa .rev-block h4{margin:0 0 6px;font-size:14px;font-weight:700;color:var(--leaf)}
.pa .rev-block .kv{font-size:13px;margin:3px 0}
.pa .blockhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.pa .blockhead h4{margin:0}
.pa .avg-pill{font-size:12px;font-weight:700;color:var(--leaf);background:var(--leaf-soft);border-radius:999px;padding:3px 10px;white-space:nowrap}
.pa .sum-grid{display:grid;grid-template-columns:130px 1fr;gap:6px 14px;font-size:13px;align-items:start}
.pa .sum-grid .sl{color:var(--muted);font-weight:600}
.pa .chips{display:flex;flex-wrap:wrap;gap:6px}
.pa .chip{font-size:11.5px;font-weight:600;background:#f1f5f9;color:#334155;border:1px solid var(--line);border-radius:999px;padding:2px 9px}
.pa .sum-list .sum-item{padding:9px 0;border-top:1px dashed var(--line)}
.pa .sum-list .sum-item:first-child{border-top:none;padding-top:2px}
.pa .sum-head{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}
.pa .sum-head .sum-text{flex:1 1 auto;min-width:160px;font-size:13px}
.pa .sum-head .rb-pill{margin-left:auto}
.pa .sum-idx{flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:var(--leaf-soft);color:var(--leaf);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;margin-top:1px}
.pa .sum-rates{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0 28px}
.pa .rb-pill{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;background:#f1f5f9;color:#475569;white-space:nowrap}
.pa .rb-pill.g{background:#dcfce7;color:#166534}
.pa .rb-pill.o{background:#ffedd5;color:#9a3412}
.pa .rb-pill.r{background:#fee2e2;color:#991b1b}
.pa .sum-sub{font-size:12.5px;color:var(--muted);margin:4px 0 0 28px}
.pa .sum-sub.warn{color:#b45309}
.pa .cult-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px;margin-top:4px}
.pa .cult-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:6px 10px}
.pa .mini-scores{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.pa .ms{background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 12px;text-align:center;min-width:64px}
.pa .ms span{display:block;font-size:11px;color:var(--muted);font-weight:600;margin-bottom:1px}
.pa .ms b{font-size:15px;font-variant-numeric:tabular-nums}
.pa .note{font-size:12.5px;color:#3730a3;background:var(--leaf-soft);border:1px solid #e0e7ff;border-radius:12px;padding:10px 13px;margin:8px 0}
.pa .warn-box{font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 13px;margin-top:12px}
.pa .cap-note{font-size:13px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 13px;margin-top:10px}
/* validation */
.pa .req-error{border-color:#ef4444!important;background:#fff8f8!important;box-shadow:0 0 0 3px rgba(239,68,68,.16)!important}
.pa .rate-err{outline:2px solid #ef4444;outline-offset:3px;border-radius:12px}
.pa .req-star{color:#ef4444;font-size:11px;vertical-align:super;line-height:0;margin-left:1px}
.pa .err-msg{font-size:12.5px;color:#dc2626;margin-top:3px;display:block;line-height:1.4}
.pa .top-err{font-size:12.5px;padding:9px 13px;background:#fef2f2;border:1px solid #fecaca;border-left:3px solid #ef4444;border-radius:10px;margin-bottom:12px}
@media (max-width:760px){.pa .gb,.pa .grid2,.pa .tmpl,.pa .rate{grid-template-columns:1fr}.pa .facet{width:100%}}
@media print{
  /* A4 page geometry with consistent margins */
  @page{size:A4 portrait;margin:14mm}
  html,body{background:#fff!important}
  /* Faithful colours (score badge, severity dots, warn boxes) */
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  /* Isolate the Review & Submit document — hide app shell, tabs, banners, etc. */
  body:has(#pa-print) *{visibility:hidden!important}
  body:has(#pa-print) #pa-print,body:has(#pa-print) #pa-print *{visibility:visible!important}
  #pa-print{position:absolute!important;left:0;top:0;width:100%!important;max-width:none!important;margin:0!important}
  /* Drop interactive / non-content controls even inside the printed area */
  .no-print,.pa .stepnav,.pa .navbtns,.pa .addbtn,.pa .rm,.pa .ghost,.pa-save-btn{display:none!important}
  /* Consistent typography */
  #pa-print{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f172a;font-size:10.5pt;line-height:1.45}
  #pa-print h2{font-size:17pt;margin:0 0 12px}
  #pa-print h3{font-size:12pt}
  #pa-print h4{font-size:11pt;margin:0 0 4px}
  /* Flatten the outer card; lighten nested cards so nothing stacks heavy chrome */
  #pa-print.card{border:none!important;box-shadow:none!important;padding:0!important;margin:0!important;border-radius:0!important}
  #pa-print .card{box-shadow:none!important;border:1px solid #e2e8f0!important;border-radius:8px!important;padding:12px 14px!important;margin:0 0 12px!important}
  /* Never split a logical block across a page boundary */
  #pa-print .rev-block,#pa-print .contrib,#pa-print .scorebar,#pa-print .cap-note,#pa-print .warn-box,#pa-print .map-row,#pa-print table,#pa-print tr{page-break-inside:avoid;break-inside:avoid}
  #pa-print h2,#pa-print h3,#pa-print h4{page-break-after:avoid;break-after:avoid}
  /* Nothing clipped or scroll-truncated */
  #pa-print *{max-height:none!important;overflow:visible!important}
  #pa-print .rev-block{margin-bottom:12px}
}
.pa-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
/* Transient confirmation toast — pinned bottom-right, visible without scrolling. */
.pa-toast{position:fixed;bottom:28px;right:28px;z-index:300;display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border:none;border-radius:14px;padding:16px 22px;font-size:15.5px;font-weight:700;box-shadow:0 12px 40px rgba(22,163,74,.45);max-width:440px;animation:pa-toast-in .25s cubic-bezier(.16,1,.3,1)}
.pa-toast.warn{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;box-shadow:0 12px 40px rgba(245,158,11,.45)}
@keyframes pa-toast-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.pa-dialog{background:#fff;border-radius:18px;padding:28px 28px 22px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.22)}
.pa-dialog h3{margin:0 0 8px;font-size:17px;font-weight:800;letter-spacing:-.02em;color:#0f172a;font-family:inherit}
.pa-dialog p{margin:0 0 22px;font-size:14px;color:#64748b;line-height:1.6}
.pa-dialog .da{display:flex;gap:10px;justify-content:flex-end}
.pa-save-btn{background:var(--leaf-soft);color:var(--leaf);border:1px solid #c7d2fe;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s}
.pa-save-btn:hover{background:#e0e7ff}
.pa .miss-card{margin-top:10px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;padding:11px 14px 9px;cursor:pointer;transition:all .15s}
.pa .miss-card:hover{background:#fef3c7;border-color:#f59e0b}
.pa .miss-card-hd{font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.pa .miss-field{display:flex;align-items:center;gap:6px;font-size:13px;color:#78350f;padding:2px 0;line-height:1.4}
.pa .miss-dot{width:5px;height:5px;border-radius:50%;background:#f59e0b;flex-shrink:0}
.pa .miss-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.pa .miss-go-btn{background:#f59e0b;color:#fff;border:none;border-radius:8px;padding:6px 13px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0}
.pa .miss-go-btn:hover{background:#d97706}
`;

// ── Component ────────────────────────────────────────────────────────────────
export default function PerformanceAssessmentPage() {
  const { user, hasFullPerformanceAccess, isLead, isCEO, isHR, isAdmin } =
    useAuth();
  const canManageCycles = isCEO || isHR || isAdmin;

  // ── State ────────────────────────────────────────────────────────────────
  const [view, setView] = useState<PerfView>("self");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);

  // 360 flow — reviewer nomination + active cycle
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [orgUsersStatus, setOrgUsersStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [reviewerSearch, setReviewerSearch] = useState("");
  const [activeCycle, setActiveCycle] = useState<ReviewCycle | null>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [existingSelf, setExistingSelf] =
    useState<PerformanceAssessmentRow | null>(null);
  const [booting, setBooting] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);
  const [mode, setModeState] = useState<"self" | "rev">("self");
  const [level, setLevelState] = useState<"junior" | "mid" | "senior">("mid");
  const [draftFound, setDraftFound] = useState(false);
  const [flash, setFlash] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [pendingStep, setPendingStep] = useState<number | null>(null);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [hasSubmitAttempt, setHasSubmitAttempt] = useState(false);

  // Form fields
  const [emp, setEmp] = useState("");
  const [rev, setRev] = useState("");
  const [desig, setDesig] = useState("");
  const [period, setPeriod] = useState("");
  const [facets, setFacets] = useState<Set<string>>(new Set());

  // Contributions
  const [contributions, setContributions] = useState<Contribution[]>(() => [
    blankContrib(1),
  ]);
  const [cCounter, setCCounter] = useState(1);

  // Entries
  const [teamEntries, setTeamEntries] = useState<Entry[]>(() => [blankEntry(1)]);
  const [orgEntries, setOrgEntries] = useState<Entry[]>(() => [blankEntry(2)]);
  const [eCounter, setECounter] = useState(2);

  // Culture
  const [cultRatings, setCultRatings] = useState<Record<string, number>>({});
  const [cultComment, setCultComment] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topErr, setTopErr] = useState("");
  const topErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────────
  // Restore an explicitly saved draft straight into the form fields so a
  // refresh brings the user back to exactly what they saved.
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      applyState(JSON.parse(raw));
      setDraftFound(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changes not saved to draft live only in React state, so a refresh discards
  // them — warn first with the browser's native "changes may not be saved"
  // prompt while the form is dirty.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Prefill the self-assessment identity fields from the signed-in user.
  useEffect(() => {
    if (!user) return;
    if (user.name) {
      setEmp((prev) => prev || user.name);
      setRev((prev) => prev || user.name);
    }
    if (user.role) setDesig((prev) => prev || user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.role]);

  // Default the review period to the open cycle's name once it loads.
  useEffect(() => {
    if (activeCycle?.name) setPeriod((prev) => prev || activeCycle.name);
  }, [activeCycle?.name]);

  // Load the org directory (for reviewer nomination), the active review cycle,
  // the pending-review count (My Reviews badge) and any already-submitted
  // self-assessment so we can show/fetch it instead of a blank form.
  const loadOrgUsers = useCallback(() => {
    setOrgUsersStatus("loading");
    usersApi
      .list()
      .then((r) => {
        setOrgUsers(r.users || []);
        setOrgUsersStatus("loaded");
      })
      .catch((e) => {
        console.error("Failed to load colleagues:", e);
        setOrgUsersStatus("error");
      });
  }, []);

  useEffect(() => {
    loadOrgUsers();
    Promise.allSettled([
      performanceAssessments.activeCycle().then((r) => setActiveCycle(r.cycle)),
      performanceAssessments
        .myReviews("pending")
        .then((r) => setPendingReviews((r.reviews || []).length)),
      performanceAssessments.myAssessments().then((r) => {
        const self =
          (r.assessments || []).find((a) => a.status === "submitted") ||
          (r.assessments || [])[0] ||
          null;
        if (self) {
          setExistingSelf(self);
          setSubmitted(true);
          setDraftFound(false);
          // Load the submitted snapshot into the form and lock the wizard to
          // the read-only Review & Submit step — submitted assessments are
          // view-only.
          performanceAssessments
            .get(self.id)
            .then((res) => {
              const d = res.assessment?.data;
              if (d && Object.keys(d).length) {
                applyState(d as Record<string, unknown>);
              }
            })
            .catch(() => {})
            .finally(() => setStep(6));
        }
      }),
    ]).finally(() => setBooting(false));
    // applyState is declared below and stable; including it in deps would be a
    // temporal-dead-zone reference at render time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrgUsers]);

  const toggleReviewer = useCallback((id: string) => {
    setReviewerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev; // cap at 2 peer reviewers
      return [...prev, id];
    });
    setIsDirty(true);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  }, []);

  const showTopErr = useCallback((msg: string) => {
    setTopErr(msg);
    if (topErrTimer.current) clearTimeout(topErrTimer.current);
    topErrTimer.current = setTimeout(() => setTopErr(""), 8000);
  }, []);

  const clearErr = useCallback((key: string) => {
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }, []);

  const errCls = (key: string) => (errors[key] ? "req-error" : "");
  const Err = ({ k }: { k: string }) =>
    errors[k] ? <span className="err-msg">{errors[k]}</span> : null;

  // ── Navigation ───────────────────────────────────────────────────────────
  const goto = useCallback((i: number) => {
    setStep(i);
    setTopErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onAck = useCallback((checked: boolean) => {
    setAckChecked(checked);
    setUnlocked(checked);
  }, []);

  // ── Facets ───────────────────────────────────────────────────────────────
  const toggleFacet = useCallback(
    (k: string) => {
      setFacets((p) => {
        const n = new Set(p);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      });
      clearErr("facets");
      setIsDirty(true);
    },
    [clearErr],
  );

  // ── Contributions ────────────────────────────────────────────────────────
  const addContrib = useCallback(() => {
    setIsDirty(true);
    setCCounter(cCounter + 1);
    setContributions((p) => {
      // Derive the id from the current list (counter as a floor) so a rapid
      // double-click can't create two contributions with the same id / React key.
      const id = Math.max(cCounter + 1, p.reduce((m, c) => Math.max(m, c.id), 0) + 1);
      return [...p, blankContrib(id)];
    });
  }, [cCounter]);

  const removeContrib = useCallback((id: number) => {
    // At least one Individual Contribution is mandatory — never remove the last.
    setContributions((p) => (p.length <= 1 ? p : p.filter((c) => c.id !== id)));
    setIsDirty(true);
  }, []);

  const updContrib = useCallback(
    <K extends keyof Contribution>(
      id: number,
      field: K,
      value: Contribution[K],
    ) => {
      setContributions((p) =>
        p.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
      );
      clearErr("c" + id + "_" + String(field));
      setIsDirty(true);
    },
    [clearErr],
  );

  // Proof file upload — stores the real file in S3 (via the shared uploads
  // API) so reviewers can open/download it, not just see the name.
  const [proofUploading, setProofUploading] = useState<Record<number, boolean>>(
    {},
  );

  const handleProofFile = useCallback(
    async (id: number, file: File) => {
      if (file.size > PROOF_MAX_BYTES) {
        showFlash("⚠️ File too large — max 8 MB");
        return;
      }
      setProofUploading((p) => ({ ...p, [id]: true }));
      try {
        const url = await uploads.uploadFileSmart(file);
        setContributions((p) =>
          p.map((c) =>
            c.id === id ? { ...c, prooffilename: file.name, proofurl: url } : c,
          ),
        );
        setIsDirty(true);
        showFlash("📎 Proof uploaded — " + file.name);
      } catch (err) {
        showFlash(
          "⚠️ " +
            (err instanceof ApiError && err.status === 503
              ? "File upload is not configured on the server"
              : "Upload failed — please try again"),
        );
      } finally {
        setProofUploading((p) => ({ ...p, [id]: false }));
      }
    },
    [showFlash],
  );

  const clearProofFile = useCallback((id: number) => {
    setContributions((p) =>
      p.map((c) =>
        c.id === id ? { ...c, prooffilename: "", proofurl: "" } : c,
      ),
    );
    setIsDirty(true);
  }, []);

  const pickSelf = useCallback(
    (id: number, n: number) => {
      setContributions((p) =>
        p.map((c) => (c.id === id ? { ...c, self: n } : c)),
      );
      clearErr("c" + id + "_self");
      setIsDirty(true);
    },
    [clearErr],
  );

  const pickReviewer = useCallback((id: number, n: number) => {
    setContributions((p) =>
      p.map((c) => (c.id === id ? { ...c, reviewer: n } : c)),
    );
    setIsDirty(true);
  }, []);

  const toggleImpact = useCallback((id: number, k: string) => {
    setContributions((p) =>
      p.map((c) => {
        if (c.id !== id) return c;
        const impacts = [...c.impacts];
        const i = impacts.indexOf(k);
        if (i < 0) impacts.push(k);
        else impacts.splice(i, 1);
        return { ...c, impacts };
      }),
    );
    setIsDirty(true);
  }, []);

  const saveImpactWhy = useCallback((id: number, k: string, v: string) => {
    setContributions((p) =>
      p.map((c) =>
        c.id === id ? { ...c, impactWhy: { ...c.impactWhy, [k]: v } } : c,
      ),
    );
    setIsDirty(true);
  }, []);

  const addCustomField = useCallback((id: number) => {
    setContributions((p) =>
      p.map((c) =>
        c.id === id ? { ...c, custom: [...c.custom, { q: "", a: "" }] } : c,
      ),
    );
    setIsDirty(true);
  }, []);

  const removeCustomField = useCallback((id: number, ci: number) => {
    setContributions((p) =>
      p.map((c) =>
        c.id === id
          ? { ...c, custom: c.custom.filter((_, i) => i !== ci) }
          : c,
      ),
    );
    setIsDirty(true);
  }, []);

  const updCustom = useCallback(
    (id: number, ci: number, field: "q" | "a", val: string) => {
      setContributions((p) =>
        p.map((c) => {
          if (c.id !== id) return c;
          const custom = [...c.custom];
          custom[ci] = { ...custom[ci], [field]: val };
          return { ...c, custom };
        }),
      );
      setIsDirty(true);
    },
    [],
  );

  // ── Entries ───────────────────────────────────────────────────────────────
  const addEntry = useCallback(
    (section: "team" | "org") => {
      setIsDirty(true);
      setECounter(eCounter + 1);
      const setter = section === "team" ? setTeamEntries : setOrgEntries;
      setter((p) => {
        // id derived from the current list (counter as a floor) — duplicate-key safe
        // even on a rapid double-click.
        const id = Math.max(eCounter + 1, p.reduce((m, e) => Math.max(m, e.id), 0) + 1);
        return [...p, blankEntry(id)];
      });
    },
    [eCounter],
  );

  const removeEntry = useCallback((section: "team" | "org", eid: number) => {
    const setter = section === "team" ? setTeamEntries : setOrgEntries;
    // At least one entry per section is mandatory — never remove the last one.
    setter((p) => (p.length <= 1 ? p : p.filter((e) => e.id !== eid)));
    setIsDirty(true);
  }, []);

  const updEntry = useCallback(
    (section: "team" | "org", eid: number, field: string, value: unknown) => {
      const setter = section === "team" ? setTeamEntries : setOrgEntries;
      setter((p) =>
        p.map((e) => (e.id === eid ? { ...e, [field]: value } : e)),
      );
      clearErr("e_" + section + "_" + eid + "_" + field);
      setIsDirty(true);
    },
    [clearErr],
  );

  const pickEntry = useCallback(
    (section: "team" | "org", eid: number, n: number) => {
      const setter = section === "team" ? setTeamEntries : setOrgEntries;
      setter((p) => p.map((e) => (e.id === eid ? { ...e, rating: n } : e)));
      clearErr("e_" + section + "_" + eid + "_rate");
      setIsDirty(true);
    },
    [clearErr],
  );

  // ── Suggest (computed per render) ─────────────────────────────────────────
  const computeSuggested = useCallback(
    (c: Contribution) => {
      const create = c.create;
      if (!create) return { suggested: null, why: [], flagged: false };

      const flagged = [
        c.context,
        c.problem,
        c.create,
        c.adopt,
        c.changed,
        c.value,
        c.sustain,
        c.evidence,
        c.proofref,
      ].some((s) => INJECT.test(s || ""));

      const text = (c.adopt + " " + c.changed + " " + c.value).toLowerCase();
      const hasNums = /[0-9]/.test(c.changed + " " + c.value);
      const strongAdopt =
        /(production|deployed|live|used by|adopted|projects|customers|standard|since|rolled out|in use)/.test(
          text,
        );
      const noAdopt =
        /(not adopted|prototype|concept only|not used|unused|\bpoc\b|yet to|will be|planned)/.test(
          text,
        );
      const capText =
        /(first|novel|new capability|usp|differentiator|won|revenue|crore|\bcr\b|lakh|₹)/.test(
          (c.create + " " + c.value).toLowerCase(),
        );
      const hs = HIGH_BY_LEVEL[level] || HIGH_BY_LEVEL.mid;
      const cap = capText || c.impacts.some((x) => hs.includes(x));

      const complete = !!(c.create && c.adopt && c.changed && c.value);
      const allStory = [
        "problem",
        "create",
        "adopt",
        "changed",
        "value",
        "sustain",
      ].every((k) => !!(c as unknown as Record<string, string>)[k]);
      const proof = allStory && !!c.proofref;
      const attached = !!c.proofref || !!c.prooffilename;

      let n = 3;
      const why: string[] = [];
      if (!complete) {
        n = 2;
        why.push("story incomplete");
      } else if (noAdopt) {
        n = 2;
        why.push("not adopted / not in use");
      } else {
        why.push("described and adopted");
        if (strongAdopt && hasNums) {
          n = 4;
          why.push("clear adoption + measurable numbers");
        }
        if (strongAdopt && hasNums && cap && proof) {
          n = 5;
          why.push("high-impact for your level + attached proof");
        }
      }
      if (n >= 4 && !attached) {
        if (n === 5) n = 4;
        why.push("attach a proof link/file to confirm");
      }
      if (n === 5 && !proof) {
        n = 4;
        why.push("Exceptional proof incomplete → Exceeds");
      }

      return { suggested: n, why, flagged };
    },
    [level],
  );

  // ── Score ─────────────────────────────────────────────────────────────────
  const govRating = useCallback(
    (c: Contribution) => (mode === "rev" ? (c.reviewer ?? c.self) : c.self),
    [mode],
  );

  const proofOK = useCallback(
    (c: Contribution) =>
      ["problem", "create", "adopt", "changed", "value", "sustain"].every(
        (k) => !!(c as unknown as Record<string, string>)[k],
      ) && !!c.proofref,
    [],
  );

  const contribEff = useCallback(
    (c: Contribution) => {
      const r = govRating(c);
      if (r == null) return { eff: null, down: false };
      if (r === 5 && !proofOK(c)) return { eff: 4, down: true };
      return { eff: r, down: false };
    },
    [govRating, proofOK],
  );

  const indScore = useCallback(() => {
    // Average across all rated contributions (an Exceptional missing full
    // proof still counts as 4 via contribEff before averaging).
    let sum = 0;
    let n = 0;
    let anyDown = false;
    contributions.forEach((c) => {
      const { eff, down } = contribEff(c);
      if (eff == null) return;
      if (down) anyDown = true;
      sum += eff;
      n += 1;
    });
    return { avg: n ? Number((sum / n).toFixed(2)) : null, anyDown };
  }, [contributions, contribEff]);

  const avgOf = (arr: Entry[]) => {
    const v = arr
      .filter((e) => e.rating != null)
      .map((e) => e.rating as number);
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  };

  const cultAvg = () => {
    const v = Object.values(cultRatings);
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  };

  const tAvg = avgOf(teamEntries);
  const oAvg = avgOf(orgEntries);
  const cAvg = cultAvg();
  const ind = indScore();

  const totalScore =
    ind.avg != null && tAvg != null && oAvg != null && cAvg != null
      ? (ind.avg * W.ind + tAvg * W.team + oAvg * W.org + cAvg * W.culture) /
        100
      : null;

  const displayIdx = totalScore != null ? catIndexOf(totalScore) : -1;

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (ind.anyDown)
    warnings.push(
      "💡 An Exceptional (5) contribution is missing full proof, so it counts as Exceeds (4) for now.",
    );
  contributions.forEach((c, i) => {
    const r = govRating(c);
    if (r != null && r >= 4 && !c.proofref && !c.prooffilename)
      warnings.push(
        `💡 Contribution #${i + 1} is rated 4–5 — attaching a proof link or file will help confirm it.`,
      );
    if (computeSuggested(c).flagged)
      warnings.push(
        `🛡 Contribution #${i + 1}: instruction-like text found and ignored.`,
      );
  });

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(
    (s: number): boolean => {
      const errs: Record<string, string> = {};
      let te = "";

      if (s === 1) {
        if (!emp.trim()) errs["emp"] = "Please enter the employee name";
        if (!rev.trim())
          errs["rev"] =
            mode === "self"
              ? "Please enter your name"
              : "Please enter the reviewer name";
        if (!desig.trim()) errs["desig"] = "Please enter the designation";
        if (!facets.size)
          errs["facets"] = "Please select at least one role area";
      } else if (s === 2) {
        if (!contributions.length)
          te = "Please add at least one contribution using the button below";
        contributions.forEach((c) => {
          if (!c.title.trim())
            errs["c" + c.id + "_title"] =
              "Please enter the task / project title";
          if (!c.area) errs["c" + c.id + "_area"] = "Please select a role area";
          if (c.self == null)
            errs["c" + c.id + "_self"] = "Please select your self-rating (1–5)";
          if (!c.context.trim())
            errs["c" + c.id + "_context"] =
              "Please describe what you were asked to do";
          if (!c.problem.trim())
            errs["c" + c.id + "_problem"] =
              "Please describe the problem this work addressed";
          if (!c.create.trim())
            errs["c" + c.id + "_create"] = "Please describe what you created";
          if (!c.adopt.trim())
            errs["c" + c.id + "_adopt"] =
              "Please describe the adoption and who is using it";
          if (!c.changed.trim())
            errs["c" + c.id + "_changed"] =
              "Please describe what changed because of it";
          if (!c.value.trim())
            errs["c" + c.id + "_value"] =
              "Please describe how FarmwiseAI is better because of it";
        });
      } else if (s === 3) {
        if (!teamEntries.length)
          te =
            "Please add at least one team contribution using the button below";
        teamEntries.forEach((e) => {
          if (!e.text.trim())
            errs["e_team_" + e.id + "_text"] =
              "Please describe the team contribution";
          if (e.rating == null)
            errs["e_team_" + e.id + "_rate"] = "Please select a rating (1–5)";
        });
      } else if (s === 4) {
        if (!orgEntries.length)
          te =
            "Please add at least one organisation contribution using the button below";
        orgEntries.forEach((e) => {
          if (!e.text.trim())
            errs["e_org_" + e.id + "_text"] =
              "Please describe the organisation contribution";
          if (e.rating == null)
            errs["e_org_" + e.id + "_rate"] = "Please select a rating (1–5)";
        });
      } else if (s === 5) {
        let missingCult = 0;
        CULT_ITEMS.forEach(([k, label]) => {
          if (cultRatings[k] == null) {
            errs["b_culture_" + k] = `Please select a rating for "${label}"`;
            missingCult++;
          }
        });
        if (missingCult)
          te =
            "Please select a rating for all mandatory Culture & Discipline items.";
      }

      setErrors(errs);
      if (te) showTopErr(te);
      return !Object.keys(errs).length && !te;
    },
    [
      emp,
      rev,
      desig,
      facets,
      contributions,
      teamEntries,
      orgEntries,
      cultRatings,
      showTopErr,
    ],
  );

  const validateAll = useCallback((): SubmitStepError[] => {
    const result: SubmitStepError[] = [];
    type F = { key: string; label: string; shortLabel: string };

    // Step 1
    {
      const errs: Record<string, string> = {};
      const fields: F[] = [];
      const add = (k: string, msg: string, sl: string) => {
        errs[k] = msg;
        fields.push({ key: k, label: msg, shortLabel: sl });
      };
      if (!emp.trim())
        add("emp", "Please enter the employee name", "Employee Name");
      if (!rev.trim())
        add(
          "rev",
          mode === "self"
            ? "Please enter your name"
            : "Please enter the reviewer name",
          mode === "self" ? "Your Name" : "Reviewer Name",
        );
      if (!desig.trim())
        add("desig", "Please enter the designation", "Designation");
      if (!facets.size)
        add("facets", "Please select at least one role area", "Role Areas");
      if (fields.length)
        result.push({
          step: 1,
          stepLabel: "About You & Role",
          topMsg: "",
          topShortLabel: "",
          fields,
          errs,
        });
    }

    // Step 2
    {
      const errs: Record<string, string> = {};
      const fields: F[] = [];
      const add = (k: string, msg: string, sl: string) => {
        errs[k] = msg;
        fields.push({ key: k, label: msg, shortLabel: sl });
      };
      let topMsg = "";
      let topShortLabel = "";
      if (!contributions.length) {
        topMsg = "Please add at least one contribution";
        topShortLabel = "Add a Contribution";
      }
      contributions.forEach((c, idx) => {
        const p = `c${c.id}`;
        const n = `#${idx + 1}`;
        if (!c.title.trim())
          add(
            `${p}_title`,
            "Please enter the task / project title",
            `Title (Contribution ${n})`,
          );
        if (!c.area)
          add(
            `${p}_area`,
            "Please select a role area",
            `Role Area (Contribution ${n})`,
          );
        if (c.self == null)
          add(
            `${p}_self`,
            "Please select your self-rating (1–5)",
            `Self-Rating (Contribution ${n})`,
          );
        if (!c.context.trim())
          add(
            `${p}_context`,
            "Please describe what you were asked to do",
            `Task Context (Contribution ${n})`,
          );
        if (!c.problem.trim())
          add(
            `${p}_problem`,
            "Please describe the problem this work addressed",
            `Problem Statement (Contribution ${n})`,
          );
        if (!c.create.trim())
          add(
            `${p}_create`,
            "Please describe what you created",
            `What You Created (Contribution ${n})`,
          );
        if (!c.adopt.trim())
          add(
            `${p}_adopt`,
            "Please describe the adoption",
            `Adoption Details (Contribution ${n})`,
          );
        if (!c.changed.trim())
          add(
            `${p}_changed`,
            "Please describe what changed",
            `What Changed (Contribution ${n})`,
          );
        if (!c.value.trim())
          add(
            `${p}_value`,
            "Please describe the value to FarmwiseAI",
            `Value Delivered (Contribution ${n})`,
          );
      });
      if (fields.length || topMsg)
        result.push({
          step: 2,
          stepLabel: "Individual Contributions",
          topMsg,
          topShortLabel,
          fields,
          errs,
        });
    }

    // Step 3
    {
      const errs: Record<string, string> = {};
      const fields: F[] = [];
      const add = (k: string, msg: string, sl: string) => {
        errs[k] = msg;
        fields.push({ key: k, label: msg, shortLabel: sl });
      };
      let topMsg = "";
      let topShortLabel = "";
      if (!teamEntries.length) {
        topMsg = "Please add at least one team contribution";
        topShortLabel = "Add a Team Entry";
      }
      teamEntries.forEach((e, idx) => {
        const p = `e_team_${e.id}`;
        const n = `#${idx + 1}`;
        if (!e.text.trim())
          add(
            `${p}_text`,
            "Please describe the team contribution",
            `Description (Team Entry ${n})`,
          );
        if (e.rating == null)
          add(
            `${p}_rate`,
            "Please select a rating (1–5)",
            `Rating (Team Entry ${n})`,
          );
      });
      if (fields.length || topMsg)
        result.push({
          step: 3,
          stepLabel: "Team Contribution",
          topMsg,
          topShortLabel,
          fields,
          errs,
        });
    }

    // Step 4
    {
      const errs: Record<string, string> = {};
      const fields: F[] = [];
      const add = (k: string, msg: string, sl: string) => {
        errs[k] = msg;
        fields.push({ key: k, label: msg, shortLabel: sl });
      };
      let topMsg = "";
      let topShortLabel = "";
      if (!orgEntries.length) {
        topMsg = "Please add at least one organisation contribution";
        topShortLabel = "Add an Organisation Entry";
      }
      orgEntries.forEach((e, idx) => {
        const p = `e_org_${e.id}`;
        const n = `#${idx + 1}`;
        if (!e.text.trim())
          add(
            `${p}_text`,
            "Please describe the organisation contribution",
            `Description (Org Entry ${n})`,
          );
        if (e.rating == null)
          add(
            `${p}_rate`,
            "Please select a rating (1–5)",
            `Rating (Org Entry ${n})`,
          );
      });
      if (fields.length || topMsg)
        result.push({
          step: 4,
          stepLabel: "Organisation Contribution",
          topMsg,
          topShortLabel,
          fields,
          errs,
        });
    }

    // Step 5
    {
      const errs: Record<string, string> = {};
      const fields: F[] = [];
      const add = (k: string, msg: string, sl: string) => {
        errs[k] = msg;
        fields.push({ key: k, label: msg, shortLabel: sl });
      };
      CULT_ITEMS.forEach(([k, label]) => {
        if (cultRatings[k] == null)
          add(`b_culture_${k}`, `Please select a rating for "${label}"`, label);
      });
      if (fields.length)
        result.push({
          step: 5,
          stepLabel: "Culture & Discipline",
          topMsg: "",
          topShortLabel: "",
          fields,
          errs,
        });
    }

    return result;
  }, [
    emp,
    rev,
    desig,
    facets,
    contributions,
    teamEntries,
    orgEntries,
    cultRatings,
    mode,
  ]);

  const submitErrors = useMemo(
    () => (hasSubmitAttempt ? validateAll() : []),
    [hasSubmitAttempt, validateAll],
  );

  const gotoValidated = useCallback(
    (from: number, to: number) => {
      if (!validate(from)) {
        setTimeout(() => {
          const el = document.querySelector(".req-error, .rate-err");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
        return;
      }
      // Deliberately no saveDraft() here — only the explicit "Save Draft"
      // button persists data, so a refresh discards anything not saved.
      goto(to);
    },
    [validate, goto],
  );

  // ── Draft ─────────────────────────────────────────────────────────────────
  const gather = useCallback(
    () => ({
      mode,
      level,
      facets: [...facets],
      emp,
      rev,
      desig,
      period,
      contributions,
      teamEntries,
      orgEntries,
      cultRatings,
      cultComment,
      reviewerIds,
    }),
    [
      mode,
      level,
      facets,
      emp,
      rev,
      desig,
      period,
      contributions,
      teamEntries,
      orgEntries,
      cultRatings,
      cultComment,
      reviewerIds,
    ],
  );

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(gather()));
      setIsDirty(false);
    } catch {
      /* ignore */
    }
  }, [gather]);

  // Apply a saved/submitted snapshot (same shape as gather()) into the form.
  const applyState = useCallback(
    (d: Record<string, unknown>) => {
      const dd = d as Record<string, never>;
      setModeState((dd.mode as "self" | "rev") || "self");
      setLevelState((dd.level as "junior" | "mid" | "senior") || "mid");
      setFacets(new Set((dd.facets as string[]) || []));
      setEmp(dd.emp || "");
      setRev(dd.rev || "");
      setDesig(dd.desig || "");
      setPeriod(dd.period || "");
      const contribs = (dd.contributions as Contribution[]) || [];
      // At least one Individual Contribution is mandatory — never start empty.
      if (!contribs.length) contribs.push(blankContrib(1));
      setContributions(contribs);
      setCCounter(Math.max(1, ...contribs.map((c) => c.id)));
      const team = (dd.teamEntries as Entry[]) || [];
      const org = (dd.orgEntries as Entry[]) || [];
      // At least one entry per section is mandatory — never start empty.
      if (!team.length) team.push(blankEntry(1));
      if (!org.length) org.push(blankEntry(2));
      setTeamEntries(team);
      setOrgEntries(org);
      setECounter(
        Math.max(2, ...team.map((e) => e.id), ...org.map((e) => e.id)),
      );
      setCultRatings((dd.cultRatings as Record<string, number>) || {});
      setCultComment(dd.cultComment || "");
      setReviewerIds((dd.reviewerIds as string[]) || []);
      onAck(true);
      setIsDirty(false);
    },
    [onAck],
  );

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftFound(false);
    // Reset back to a fresh form, keeping the signed-in prefills.
    applyState({
      emp: user?.name || "",
      rev: user?.name || "",
      desig: user?.role || "",
      period: activeCycle?.name || "",
    });
    goto(0);
  }, [applyState, goto, user?.name, user?.role, activeCycle?.name]);

  const navigateToError = useCallback(
    (se: SubmitStepError) => {
      setErrors(se.errs);
      if (se.topMsg) showTopErr(se.topMsg);
      goto(se.step);
      setTimeout(() => {
        const el = document.querySelector(".req-error, .rate-err, .top-err");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    },
    [goto, showTopErr],
  );

  const handleSubmitClick = () => {
    const allErrors = validateAll();
    if (allErrors.length) {
      setHasSubmitAttempt(true);
      return;
    }
    setHasSubmitAttempt(false);
    setShowSubmitConfirm(true);
  };

  const submitAssessment = async () => {
    setShowSubmitConfirm(false);
    saveDraft();

    const band =
      totalScore != null && displayIdx >= 0 ? CATS[displayIdx].name : null;
    const payload = {
      employee_name: emp.trim(),
      employee_user_id: mode === "self" ? (user?.id ?? null) : null,
      subject_user_id: user?.id ?? null,
      designation: desig.trim(),
      review_period: period.trim() || activeCycle?.name || null,
      career_level: level,
      filled_by: mode,
      kind: "self",
      cycle_id: activeCycle?.id ?? null,
      reviewer_ids: reviewerIds,
      reviewer_name: rev.trim() || null,
      reviewer_user_id: user?.id ?? null,
      role_areas: [...facets],
      individual_score: ind.avg,
      team_score: tAvg,
      org_score: oAvg,
      culture_score: cAvg,
      total_score: totalScore,
      rating_band: band,
      data: gather(),
    };

    setSubmitting(true);
    try {
      const res = await performanceAssessments.create(payload);
      setSubmitted(true);
      // The assessment now lives on the server — drop the local draft so a
      // refresh doesn't restore stale pre-submit data.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setDraftFound(false);
      setIsDirty(false);
      // Re-fetch so the saved submission persists across reloads / tab switches.
      performanceAssessments
        .myAssessments()
        .then((r) => {
          const self =
            (r.assessments || []).find((a) => a.status === "submitted") ||
            (r.assessments || [])[0] ||
            null;
          if (self) setExistingSelf(self);
        })
        .catch(() => {});
      const mgrNote = res?.manager_assigned ? " Your reporting manager has been assigned a manager review." : "";
      showFlash(
        reviewerIds.length
          ? `✅ Assessment saved. ${reviewerIds.length} reviewer${reviewerIds.length > 1 ? "s" : ""} notified to complete your peer review.${mgrNote}`
          : `✅ Assessment saved and shared with your reporting line and leadership.${mgrNote}`,
      );
    } catch (e) {
      console.error("performance assessment submit failed", e);
      showFlash(
        "⚠️ Couldn't reach the server — saved on this device. Try Submit again, or use Print / PDF.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reusable sub-components ───────────────────────────────────────────────
  // Summary helpers: "Meets (3)" label + green/orange/red tone per the same
  // band mapping as the legend (3–5 green, 2 orange, 1 red).
  const rateLabel = (n: number | null | undefined) =>
    n != null ? `${LN[NUM.indexOf(n)]} (${n})` : "—";
  const rateTone = (n: number | null | undefined) =>
    n == null ? "" : n >= 3 ? " g" : n === 2 ? " o" : " r";

  const RatingRow = ({
    n,
    i,
    selected,
    onClick,
  }: {
    n: number;
    i: number;
    selected: boolean;
    onClick: () => void;
  }) => (
    <div className={`rb ${selected ? "sel" : ""}`} onClick={onClick}>
      <b>{n}</b>
      {LN[i]}
    </div>
  );

  const EntryBlock = ({
    section,
    e,
    idx,
  }: {
    section: "team" | "org";
    e: Entry;
    idx: number;
  }) => {
    const tkey = "e_" + section + "_" + e.id;
    const entryCount = (section === "team" ? teamEntries : orgEntries).length;
    return (
      <div className="block">
        <div
          className="ch"
          style={{
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h4 style={{ margin: 0, fontSize: 13, color: "var(--leaf)" }}>
            Contribution #{idx + 1}
          </h4>
          {entryCount > 1 && (
            <button className="rm" onClick={() => removeEntry(section, e.id)}>
              Remove
            </button>
          )}
        </div>
        <div className="field">
          <label>
            What was the contribution? <span className="req-star">*</span>
          </label>
          <textarea
            className={errCls(tkey + "_text")}
            value={e.text}
            onChange={(ev) => updEntry(section, e.id, "text", ev.target.value)}
            placeholder={
              section === "team"
                ? "e.g. Mentored two new engineers; built the onboarding guide the team now uses."
                : "e.g. Built a deployment script now used by 4 project teams."
            }
          />
          <Err k={tkey + "_text"} />
        </div>
        <label className="fld">
          Rating <span className="req-star">*</span>
        </label>
        <div className={`rate ${errors[tkey + "_rate"] ? "rate-err" : ""}`}>
          {NUM.map((n, i) => (
            <RatingRow
              key={n}
              n={n}
              i={i}
              selected={e.rating === n}
              onClick={() => pickEntry(section, e.id, n)}
            />
          ))}
        </div>
        <Err k={tkey + "_rate"} />
        <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          <label>
            Remarks <span className="breakdown">(optional)</span>
          </label>
          <textarea
            value={e.remark}
            onChange={(ev) =>
              updEntry(section, e.id, "remark", ev.target.value)
            }
            placeholder="Who benefited, adoption, evidence…"
          />
        </div>
      </div>
    );
  };

  const MissList = ({ se }: { se: SubmitStepError }) => (
    <div className="miss-card" onClick={() => navigateToError(se)}>
      <div className="miss-card-top">
        <div className="miss-card-hd">Missing required fields</div>
        <button
          className="miss-go-btn"
          onClick={(ev) => {
            ev.stopPropagation();
            navigateToError(se);
          }}
        >
          Go to this tab →
        </button>
      </div>
      {se.topMsg && (
        <div className="miss-field">
          <span className="miss-dot" />
          {se.topShortLabel}
        </div>
      )}
      {se.fields.map((f) => (
        <div key={f.key} className="miss-field">
          <span className="miss-dot" />
          {f.shortLabel}
        </div>
      ))}
    </div>
  );

  // Role-gated tabs for the module.
  const tabs: { key: PerfView; label: string; Icon: typeof Award }[] = [
    { key: "self", label: "My Assessment", Icon: ClipboardList },
    { key: "reviews", label: "My Reviews", Icon: Inbox },
    ...(isLead || hasFullPerformanceAccess
      ? [{ key: "team" as const, label: "My Team", Icon: Users2 }]
      : []),
    ...(hasFullPerformanceAccess
      ? [{ key: "analysis" as const, label: "Analysis", Icon: BarChart3 }]
      : []),
    ...(canManageCycles
      ? [
          { key: "cycles" as const, label: "Cycles", Icon: CalendarRange },
          { key: "org" as const, label: "Org Tree", Icon: Network },
        ]
      : []),
  ];

  const VIEW_SUBTITLE: Record<PerfView, string> = {
    self: "Capture outcomes, adoption and measurable impact — not just activity.",
    reviews: "Peer reviews colleagues have asked you to complete.",
    team: "Your team's self-assessments and peer reviews.",
    analysis: "Org-wide ratings, distribution and trends for leadership.",
    cycles: "Open and manage performance review cycles.",
    org: "Define who reports to whom — the reporting tree that scopes visibility.",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (booting) {
    return (
      <div className="max-w-[1440px] mx-auto w-full flex items-center justify-center py-32 animate-fade-in-up">
        <div className="flex flex-col items-center gap-5">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
          >
            <Award className="h-7 w-7 text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading performance
            assessment…
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{PA_CSS}</style>

      {/* Transient confirmations (Draft saved, Progress saved, …) shown as a
          bottom-right toast so they're visible without scrolling to the top. */}
      {flash && (
        <div className={`pa-toast${flash.includes("⚠️") ? " warn" : ""}`}>
          {flash}
        </div>
      )}

      {/* ── Page header (pure app styling, outside the scoped .pa block) ─── */}
      <div className="max-w-[1440px] mx-auto w-full animate-fade-in-up">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
              >
                <Award className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-display text-slate-900">
                Performance Assessment
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">
              {VIEW_SUBTITLE[view]}
            </p>
          </div>

          {/* Role-gated segmented control */}
          <div
            className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 flex-wrap"
            role="tablist"
            aria-label="Performance views"
          >
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all",
                  view === key
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
                {key === "reviews" && pendingReviews > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-[16px] rounded-full bg-amber-500 text-[10px] font-bold text-white px-1">
                    {pendingReviews}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Non-wizard views (fully app-styled, outside .pa) ──────────────── */}
      {view === "reviews" && (
        <div className="max-w-[1440px] mx-auto w-full mt-5">
          <PerformanceReviews />
        </div>
      )}
      {view === "team" && (
        <div className="max-w-[1440px] mx-auto w-full mt-5">
          <PerformanceTeam />
        </div>
      )}
      {view === "analysis" && (
        <div className="max-w-[1440px] mx-auto w-full mt-5">
          <PerformanceAnalysis />
        </div>
      )}
      {view === "cycles" && (
        <div className="max-w-[1440px] mx-auto w-full mt-5">
          <PerformanceCycles />
        </div>
      )}
      {view === "org" && (
        <div className="max-w-[1440px] mx-auto w-full mt-5">
          <OrgTreeEditor />
        </div>
      )}

      {/* ── Self-assessment wizard ───────────────────────────────────────── */}
      {view === "self" && (
        <div className="pa mt-5">
          {/* ── Step nav ──────────────────────────────────────────────────── */}
          <div className="stepnav">
            <div className="stepnav-inner">
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`sn ${step === i ? "active" : ""} ${i < step ? "done" : ""} ${(i > 0 && !unlocked) || (submitted && i !== 6) ? "locked" : ""}`}
                  onClick={() => {
                    if (i === step) return;
                    // Submitted assessments are view-only — stay on Review & Submit.
                    if (submitted && i !== 6) {
                      showFlash("✓ Assessment submitted — view only");
                      return;
                    }
                    if (i > 0 && !unlocked) return;
                    if (isDirty) {
                      setPendingStep(i);
                      setShowDraftDialog(true);
                    } else goto(i);
                  }}
                >
                  <span className="snum">{i + 1}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="wrap">
            {/* Already-submitted banner — fetched from the server on load */}
            {existingSelf && (
              <div
                className="draftbar"
                style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}
              >
                <span style={{ color: "#3730a3" }}>
                  ✓ You submitted your self-assessment
                  {existingSelf.review_period ? (
                    <>
                      {" "}
                      for <b>{existingSelf.review_period}</b>
                    </>
                  ) : null}
                  {existingSelf.rating_band ? (
                    <>
                      {" "}
                      — <b>{existingSelf.rating_band}</b>
                    </>
                  ) : null}
                  {existingSelf.total_score != null ? (
                    <> ({Number(existingSelf.total_score).toFixed(2)} / 5)</>
                  ) : null}
                  .
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button
                    className="primary"
                    onClick={() => setView("reviews")}
                  >
                    View
                  </button>
                </span>
              </div>
            )}
            {/* Draft / flash banners */}
            {draftFound && (
              <div className="draftbar">
                <span>
                  💾 Your saved draft has been restored into the form below.
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button className="ghost" onClick={discardDraft}>
                    Discard draft
                  </button>
                </span>
              </div>
            )}
            {/* ── Unsaved-changes dialog ──────────────────────────────────── */}
            {showDraftDialog && (
              <div className="pa-overlay">
                <div className="pa-dialog">
                  <h3>Unsaved changes</h3>
                  <p>
                    You have unsaved changes on this section. Save them to draft
                    before moving on, or cancel to stay here.
                  </p>
                  <div className="da">
                    <button
                      className="ghost"
                      onClick={() => {
                        setShowDraftDialog(false);
                        setPendingStep(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        saveDraft();
                        setShowDraftDialog(false);
                        if (pendingStep != null) {
                          goto(pendingStep);
                          setPendingStep(null);
                        }
                      }}
                    >
                      Save Draft &amp; Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showSubmitConfirm && (
              <div className="pa-overlay">
                <div className="pa-dialog">
                  <h3>Submit Assessment?</h3>
                  <p style={{ marginBottom: 8 }}>
                    Once submitted, <strong>you cannot edit or make any changes</strong> to this assessment.
                  </p>
                  <p style={{ fontSize: 13, color: "#64748b" }}>
                    Are you sure you want to submit?
                  </p>
                  <div className="da" style={{ marginTop: 20 }}>
                    <button
                      className="ghost"
                      onClick={() => setShowSubmitConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary"
                      onClick={submitAssessment}
                    >
                      Yes, Submit
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 0: PHILOSOPHY ──────────────────────────────────────── */}
            {step === 0 && (
              <div className="card">
                <h2>Performance Assessment Philosophy</h2>
                <p className="lead">
                  <b>
                    A quick read before you begin — it makes filling your
                    assessment much easier.
                  </b>
                </p>
                <div className="opening">
                  <p className="big">Objective of this assessment</p>
                  <p>
                    The objective is to establish a{" "}
                    <b>fair, objective, and evidence-based</b> performance
                    assessment framework for FarmwiseAI — moving away from
                    activity-based assessment and replacing it with{" "}
                    <b>outcome-based, impact-based, and adoption-based</b>{" "}
                    evaluation.
                  </p>
                  <p>
                    Performance will <b>not</b> be measured by how many meetings
                    were attended, emails sent, reports prepared, modules
                    written, or experiments conducted. It will be measured by
                    the <b>value created</b>.
                  </p>
                  <p style={{ marginBottom: 0 }}>
                    In simple terms:{" "}
                    <b>
                      we'd love to hear not just what you worked on, but the
                      difference it made.
                    </b>
                  </p>
                </div>

                <h3 className="sec">What This Assessment Asks</h3>
                <p>Every contribution should answer:</p>
                <ul>
                  <li>What did you create?</li>
                  <li>Was it adopted or used?</li>
                  <li>Who is using it today?</li>
                  <li>What changed because of your contribution?</li>
                  <li>
                    Did it save time, reduce cost, improve quality, increase
                    revenue, strengthen customer confidence, or create a new
                    company capability?
                  </li>
                  <li>How is FarmwiseAI better because of your work?</li>
                </ul>
                <ul className="pill-list">
                  {[
                    "Impact",
                    "Adoption",
                    "Ownership",
                    "Innovation",
                    "Revenue",
                    "Cost Reduction",
                    "Time Reduction",
                    "Customer Success",
                    "Team Success",
                    "Organizational Growth",
                    "Professional Conduct",
                  ].map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>

                <h3 className="sec">Activities vs Outcomes</h3>
                <div className="gb">
                  <div className="ex bad">
                    <span className="tag">Less helpful</span>"I attended 20
                    meetings." · "I wrote 10 reports." · "I developed 5
                    modules." · "I participated in 15 tenders."
                  </div>
                  <div className="ex good">
                    <span className="tag">More helpful</span>Revenue created or
                    influenced · time saved · cost saved · technology adopted ·
                    capability created · customer, team &amp; organizational
                    impact.
                  </div>
                </div>

                <h3 className="sec">The Most Important Formula</h3>
                <div className="formula">
                  Impact = Adoption × Benefit
                  <small>
                    If Adoption = 0, Impact = 0. A brilliant idea nobody uses
                    creates almost no value. A simple idea everyone uses may
                    create enormous value.
                  </small>
                </div>

                <h3 className="sec">Hierarchy of Evidence</h3>
                <p className="hint">
                  Impact is not only revenue or cost. Many roles create value
                  indirectly. Use the strongest evidence you have.
                </p>
                {[
                  {
                    lv: "Level 1 · Strongest",
                    h: "Direct Business Impact",
                    q: "Revenue generated/influenced, cost saved, time saved, headcount avoided, client/project won.",
                    ex: "e.g. Helped secure a ₹5 Cr project · Reduced cloud cost by ₹10L/yr · Cut delivery from 6 months to 20 days.",
                  },
                  {
                    lv: "Level 2",
                    h: "Adoption Impact",
                    q: "Did the organization actually use what you built?",
                    ex: "Tool adopted by 5 projects · used by 20 engineers · workflow became SOP · model in production.",
                  },
                  {
                    lv: "Level 3",
                    h: "Capability Impact",
                    q: "Did this create a capability the company did not previously possess?",
                    ex: "First OCR engine · first satellite monitoring workflow · first drone volume computation system.",
                  },
                  {
                    lv: "Level 4",
                    h: "Strategic Impact",
                    q: "Did it strengthen the company's position?",
                    ex: "Enabled entry into Telangana / Mines Dept · demo used in 10 presentations · new product offering.",
                  },
                  {
                    lv: "Level 5",
                    h: "Customer Impact",
                    q: "Did the customer benefit?",
                    ex: "Fewer complaints · higher satisfaction · fewer delays · better uptime · improved accuracy.",
                  },
                  {
                    lv: "Level 6 · Often ignored",
                    h: "Team Multiplication Impact",
                    q: "Did your work make other people more productive?",
                    ex: "Automation used by 15 employees · reusable library · docs that cut onboarding time · mentoring.",
                  },
                ].map(({ lv, h, q, ex }) => (
                  <div key={h} className="hier">
                    <span className="lv">{lv}</span>
                    <h4>{h}</h4>
                    <div className="q">{q}</div>
                    {ex}
                  </div>
                ))}

                <h3 className="sec">Impact Evidence Matrix</h3>
                <table className="matrix">
                  <tbody>
                    <tr>
                      <th>Question</th>
                      <th>Required</th>
                    </tr>
                    {[
                      ["What did you create?", "Mandatory"],
                      ["Was it adopted?", "Mandatory"],
                      ["Who used it?", "Mandatory"],
                      ["What changed because of it?", "Mandatory"],
                      ["How is the company better now?", "Mandatory"],
                      ["Is this one-time or currently in use?", "Mandatory"],
                      [
                        "How many people / projects / customers are using it?",
                        "Mandatory",
                      ],
                      ["Since when has it been used?", "Preferred"],
                      [
                        "What would happen if this contribution did not exist?",
                        "Preferred",
                      ],
                      ["Can the impact be measured?", "Preferred"],
                    ].map(([q, r]) => (
                      <tr key={q}>
                        <td>{q}</td>
                        <td className={r === "Mandatory" ? "m" : "p"}>{r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="sec">Exceptional Rating Template</h3>
                <p>
                  For an Exceptional (5), sharing all six paints the full
                  picture.
                </p>
                <div className="tmpl">
                  {[
                    ["Problem", "What problem existed?"],
                    ["Solution", "What did you create?"],
                    ["Adoption", "Who is using it?"],
                    ["Impact", "What changed (numbers)?"],
                    ["Evidence", "Metrics, usage, feedback…"],
                    ["Sustainability", "Will the benefit continue?"],
                  ].map(([t, d]) => (
                    <div key={t}>
                      <b>{t}</b>
                      <br />
                      {d}
                    </div>
                  ))}
                </div>

                <h3 className="sec">Culture &amp; Integrity Gate</h3>
                <p>
                  Culture and integrity are assessed by your reporting manager
                  as part of their manager review. Where there are serious
                  concerns around confidentiality, internal politics, gossip,
                  misrepresentation of work, repeated attendance issues,
                  accountability, respect, or policy, the final rating is
                  gently capped one band: Exceptional → Exceeds · Exceeds →
                  Meets · Meets → Below.
                </p>

                <div className="ack">
                  <label>
                    <input
                      type="checkbox"
                      checked={ackChecked}
                      onChange={(e) => onAck(e.target.checked)}
                    />
                    I've read the FarmwiseAI Performance Assessment Philosophy,
                    and I'll describe my contributions through the difference
                    they made — their adoption and measurable impact — rather
                    than activity alone.
                  </label>
                  <button
                    className="primary"
                    disabled={!ackChecked}
                    onClick={() => goto(1)}
                  >
                    I Agree — Continue to Assessment →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 1: ABOUT YOU ───────────────────────────────────────── */}
            {step === 1 && (
              <>
                <div className="card">
                  <h2>About You &amp; Your Role</h2>
                  <div className="note" style={{ marginTop: 0 }}>
                    This is your <b>self-assessment</b>
                    {activeCycle ? (
                      <>
                        {" "}
                        for <b>{activeCycle.name}</b>
                      </>
                    ) : null}
                    . Your name, designation and review period are filled in for
                    you — edit them if needed. Peer reviews of <i>others</i> are
                    completed from the <b>My Reviews</b> tab.
                  </div>

                  <div
                    className="grid2"
                    style={{ marginBottom: 12, marginTop: 12 }}
                  >
                    <div>
                      <label className="fld">
                        Your name <span className="req-star">*</span>
                      </label>
                      <input
                        className={errCls("emp")}
                        value={emp}
                        readOnly
                        style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                        placeholder="Full name"
                      />
                      <Err k="emp" />
                    </div>
                    <div>
                      <label className="fld">
                        Designation <span className="req-star">*</span>
                      </label>
                      <input
                        className={errCls("desig")}
                        value={desig}
                        readOnly
                        style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
                        placeholder="e.g. Senior Engineer"
                      />
                      <Err k="desig" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="fld">Review period</label>
                    <input
                      value={period}
                      onChange={(e) => {
                        setPeriod(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="e.g. H1 2026"
                    />
                  </div>

                  <label className="fld">Career level</label>
                  <p className="hint">
                    This tailors the questions and how impact is judged —
                    juniors are assessed on value <i>within their scope</i>, not
                    company-wide revenue.
                  </p>
                  <div className="toggle" style={{ marginBottom: 16 }}>
                    {(["junior", "mid", "senior"] as const).map((l) => (
                      <button
                        key={l}
                        className={level === l ? "on" : ""}
                        onClick={() => {
                          setLevelState(l);
                          setIsDirty(true);
                        }}
                      >
                        {l === "junior"
                          ? "Fresher / Junior"
                          : l === "mid"
                            ? "Mid-level"
                            : "Senior / Lead"}
                      </button>
                    ))}
                  </div>

                  <label className="fld">
                    Your role areas — select all that apply{" "}
                    <span className="req-star">*</span>
                  </label>
                  <p className="hint">
                    Pick every area you actually work in. Your contribution
                    questions adapt to these.
                  </p>
                  <div className={`facets ${errCls("facets")}`}>
                    {Object.entries(FACETS).map(([k, f]) => (
                      <div
                        key={k}
                        className={`facet ${facets.has(k) ? "on" : ""}`}
                        onClick={() => toggleFacet(k)}
                      >
                        <b>{f.label}</b>
                        <span>{f.hint}</span>
                      </div>
                    ))}
                  </div>
                  <Err k="facets" />

                  {facets.size > 0 && (
                    <div className="note" style={{ marginTop: 10 }}>
                      <b>What counts for your role(s):</b>
                      <br />
                      {[...facets].map((k) => (
                        <span key={k}>
                          • <b>{FACETS[k].label}:</b> {FACETS[k].hint}
                          <br />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card">
                  <div className="navbtns">
                    <button className="ghost" onClick={() => goto(0)}>
                      ← Back
                    </button>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button
                        className="pa-save-btn"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Draft saved");
                        }}
                      >
                        💾 Save Draft
                      </button>
                      <button
                        className="primary"
                        onClick={() => gotoValidated(1, 2)}
                      >
                        Next: Contributions →
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: INDIVIDUAL CONTRIBUTIONS ────────────────────────── */}
            {step === 2 && (
              <>
                <div className="card">
                  <h2>
                    Individual Contributions{" "}
                    <span className="breakdown" style={{ fontWeight: 400 }}>
                      (60%)
                    </span>
                  </h2>
                  <p className="hint">
                    Add each meaningful contribution separately and rate it on
                    its own. You may have several — e.g. two Exceptional and one
                    Exceeds.
                  </p>
                  <div
                    className="note"
                    dangerouslySetInnerHTML={{
                      __html: LEVEL_HINT[level] || "",
                    }}
                  />

                  {topErr && <div className="top-err">{topErr}</div>}

                  {contributions.map((c, idx) => {
                    const { suggested, why, flagged } = computeSuggested(c);
                    const suggCat =
                      suggested != null ? CATS[catIndexOf(suggested)] : null;

                    return (
                      <div key={c.id} className="contrib">
                        <div className="ch">
                          <h4>Contribution #{idx + 1}</h4>
                          {contributions.length > 1 && (
                            <button
                              className="rm"
                              onClick={() => removeContrib(c.id)}
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid2" style={{ marginBottom: 14 }}>
                          <div>
                            <label className="fld">
                              Task / Project title{" "}
                              <span className="req-star">*</span>
                            </label>
                            <input
                              className={errCls("c" + c.id + "_title")}
                              value={c.title}
                              onChange={(e) =>
                                updContrib(c.id, "title", e.target.value)
                              }
                              placeholder="e.g. SIPCOT spatial DB redesign"
                            />
                            <Err k={"c" + c.id + "_title"} />
                          </div>
                          <div>
                            <label className="fld">
                              Role <span className="req-star">*</span>
                            </label>
                            <select
                              className={errCls("c" + c.id + "_area")}
                              value={c.area}
                              onChange={(e) =>
                                updContrib(c.id, "area", e.target.value)
                              }
                            >
                              <option value="">
                                {facets.size
                                  ? "— select —"
                                  : "(select role on previous page)"}
                              </option>
                              {[...facets].map((k) => (
                                <option key={k} value={k}>
                                  {FACETS[k].label}
                                </option>
                              ))}
                            </select>
                            <Err k={"c" + c.id + "_area"} />
                          </div>
                        </div>

                        {/* Block 1: Self rating */}
                        <div className="block">
                          <div className="blockh">
                            <span className="stepn">1</span>Your self-rating{" "}
                            <span
                              className="req-star"
                              style={{ marginLeft: 4 }}
                            >
                              *
                            </span>
                          </div>
                          <div
                            className={`rate ${errors["c" + c.id + "_self"] ? "rate-err" : ""}`}
                          >
                            {NUM.map((n, i) => (
                              <RatingRow
                                key={n}
                                n={n}
                                i={i}
                                selected={c.self === n}
                                onClick={() => pickSelf(c.id, n)}
                              />
                            ))}
                          </div>
                          <Err k={"c" + c.id + "_self"} />
                          {c.self != null && (
                            <div
                              className="hint"
                              style={{ marginBottom: 0, marginTop: 6 }}
                            >
                              {RATE_DESC[NUM.indexOf(c.self)]}
                            </div>
                          )}
                        </div>

                        {/* Block 2: The work */}
                        <div className="block">
                          <div className="blockh">
                            <span className="stepn">2</span>The work
                          </div>
                          {[
                            {
                              k: "context",
                              label:
                                "What were you asked to do? (context / scope)",
                              ph: "The brief, the goal, and what was expected of you.",
                            },
                            {
                              k: "problem",
                              label: "What problem did it address?",
                              ph: "The problem or need this work responded to.",
                            },
                            {
                              k: "create",
                              label: "What did you create? (the solution)",
                              ph: "The product, model, workflow, framework, relationship…",
                            },
                          ].map(({ k, label, ph }) => (
                            <div key={k} className="field">
                              <label>
                                {label} <span className="req-star">*</span>
                              </label>
                              <textarea
                                className={errCls("c" + c.id + "_" + k)}
                                value={
                                  (c as unknown as Record<string, string>)[k] ||
                                  ""
                                }
                                onChange={(e) =>
                                  updContrib(
                                    c.id,
                                    k as keyof Contribution,
                                    e.target.value as never,
                                  )
                                }
                                placeholder={ph}
                              />
                              <Err k={"c" + c.id + "_" + k} />
                            </div>
                          ))}
                        </div>

                        {/* Block 3: Impact & adoption */}
                        <div className="block">
                          <div className="blockh">
                            <span className="stepn">3</span>Impact &amp;
                            adoption
                          </div>
                          {[
                            {
                              k: "adopt",
                              label:
                                "Was it adopted? Who is using it today, and since when?",
                              ph: "e.g. In production; used by AgriStack, WRD, SIPCOT since Mar 2026.",
                            },
                            {
                              k: "changed",
                              label:
                                "What changed because of it? (use numbers)",
                              ph: "e.g. Query time 15 min → 30 sec; ~70% less manual effort.",
                            },
                            {
                              k: "value",
                              label: "How is FarmwiseAI better because of it?",
                              ph: "Revenue, cost, time, capability, customer confidence, strategic position…",
                            },
                          ].map(({ k, label, ph }) => (
                            <div key={k} className="field">
                              <label>
                                {label} <span className="req-star">*</span>
                              </label>
                              <textarea
                                className={errCls("c" + c.id + "_" + k)}
                                value={
                                  (c as unknown as Record<string, string>)[k] ||
                                  ""
                                }
                                onChange={(e) =>
                                  updContrib(
                                    c.id,
                                    k as keyof Contribution,
                                    e.target.value as never,
                                  )
                                }
                                placeholder={ph}
                              />
                              <Err k={"c" + c.id + "_" + k} />
                            </div>
                          ))}
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label>
                              What kind of impact did it create? (select all
                              that apply)
                            </label>
                            <div className="tags">
                              {IMPACTS.map(([k, l]) => (
                                <span
                                  key={k}
                                  className={`tag2 ${c.impacts.includes(k) ? "on" : ""}`}
                                  onClick={() => toggleImpact(c.id, k)}
                                >
                                  {l}
                                </span>
                              ))}
                            </div>
                            {c.impacts.length > 0 && (
                              <div className="impwhy" style={{ marginTop: 8 }}>
                                <div
                                  className="hint"
                                  style={{ margin: "4px 0" }}
                                >
                                  Briefly, why does each apply? (optional but
                                  recommended)
                                </div>
                                {c.impacts.map((k) => {
                                  const lbl = (IMPACTS.find(
                                    (x) => x[0] === k,
                                  ) || [k, k])[1];
                                  return (
                                    <div key={k} className="row">
                                      <span className="lbl">{lbl}</span>
                                      <input
                                        value={c.impactWhy[k] || ""}
                                        onChange={(e) =>
                                          saveImpactWhy(c.id, k, e.target.value)
                                        }
                                        placeholder={
                                          IMPACT_EG[k] ||
                                          "Briefly, why does this apply?"
                                        }
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Block 4: Evidence */}
                        <div className="block">
                          <div className="blockh">
                            <span className="stepn">4</span>Evidence &amp; proof
                          </div>
                          <div className="field">
                            <label>
                              Will the benefit continue? (sustainability)
                            </label>
                            <textarea
                              value={c.sustain}
                              onChange={(e) =>
                                updContrib(c.id, "sustain", e.target.value)
                              }
                              placeholder="Is it durable, maintained, and likely to keep delivering?"
                            />
                          </div>
                          <div className="field">
                            <label>Evidence — metrics, usage, feedback</label>
                            <textarea
                              value={c.evidence}
                              onChange={(e) =>
                                updContrib(c.id, "evidence", e.target.value)
                              }
                              placeholder="The specifics that back up the above."
                            />
                          </div>
                          <div className="proof-row" style={{ marginBottom: 0 }}>
                            <div
                              className="field"
                              style={{ marginBottom: 0, flex: 1 }}
                            >
                              <label>Attach proof — link / reference</label>
                              <input
                                value={c.proofref}
                                onChange={(e) =>
                                  updContrib(c.id, "proofref", e.target.value)
                                }
                                placeholder="Link to a doc, dashboard, commit, screenshot…"
                              />
                            </div>
                            <span className="or-sep">or</span>
                            <div className="file-row">
                              <label className="file-btn">
                                {proofUploading[c.id] ? (
                                  <Loader2
                                    size={14}
                                    className="animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Upload size={14} aria-hidden="true" />
                                )}
                                {proofUploading[c.id]
                                  ? "uploading…"
                                  : "choose a file"}
                                <input
                                  type="file"
                                  accept={PROOF_ACCEPT}
                                  aria-label="Choose a proof file"
                                  disabled={!!proofUploading[c.id]}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    // Reset so picking the same file twice
                                    // still fires onChange.
                                    e.target.value = "";
                                    if (f) handleProofFile(c.id, f);
                                  }}
                                />
                              </label>
                              {c.prooffilename &&
                                (c.proofurl ? (
                                  <a
                                    className="file-name"
                                    href={c.proofurl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`${c.prooffilename} — open in a new tab`}
                                    style={{
                                      textDecoration: "underline",
                                      color: "var(--accent)",
                                    }}
                                  >
                                    {c.prooffilename}
                                  </a>
                                ) : (
                                  <span
                                    className="file-name"
                                    title={c.prooffilename}
                                  >
                                    {c.prooffilename}
                                  </span>
                                ))}
                              {c.prooffilename && !proofUploading[c.id] && (
                                <button
                                  type="button"
                                  className="custom-remove"
                                  aria-label="Remove the attached proof file"
                                  title="Remove the attached file"
                                  onClick={() => clearProofFile(c.id)}
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                          {c.custom.map((cp, ci) => (
                            <div
                              key={ci}
                              className="field"
                              style={{ marginTop: 10 }}
                            >
                              <div className="custom-q-row">
                                <input
                                  value={cp.q}
                                  onChange={(e) =>
                                    updCustom(c.id, ci, "q", e.target.value)
                                  }
                                  placeholder="Your own aspect / question"
                                />
                                <button
                                  type="button"
                                  className="custom-remove"
                                  aria-label="Remove this point"
                                  title="Remove this point"
                                  onClick={() =>
                                    removeCustomField(c.id, ci)
                                  }
                                >
                                  <X size={15} />
                                </button>
                              </div>
                              <textarea
                                value={cp.a}
                                onChange={(e) =>
                                  updCustom(c.id, ci, "a", e.target.value)
                                }
                                placeholder="Your answer / detail"
                                style={{ marginTop: 6 }}
                              />
                            </div>
                          ))}
                          <button
                            className="ghost"
                            style={{
                              fontSize: 12.5,
                              padding: "7px 12px",
                              marginTop: 8,
                            }}
                            onClick={() => addCustomField(c.id)}
                          >
                            + Add your own point
                          </button>
                        </div>

                        {/* Block 5: Rating check */}
                        <div className="block alt">
                          <div className="blockh">
                            <span className="stepn">5</span>Rating check
                          </div>
                          <div
                            className="field"
                            style={{ marginBottom: mode === "rev" ? 10 : 0 }}
                          >
                            <label className="fld">
                              System-suggested rating{" "}
                              <span className="breakdown">
                                (from the evidence you entered)
                              </span>
                            </label>
                            {suggested != null && suggCat ? (
                              <div className="sugg">
                                <span
                                  className="suggn"
                                  style={{ background: suggCat.color }}
                                >
                                  {suggested} · {LN[NUM.indexOf(suggested)]}
                                </span>
                                <span
                                  style={{
                                    color: "var(--muted)",
                                    fontSize: 12.5,
                                  }}
                                >
                                  {why.join("; ")}
                                </span>
                                {flagged && (
                                  <div
                                    className="note"
                                    style={{ marginTop: 6 }}
                                  >
                                    🛡 Instruction-like text was detected and
                                    ignored. This rating is based only on
                                    verifiable evidence.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className="sugg"
                                style={{ color: "var(--muted)" }}
                              >
                                Fill the fields above to see a suggestion.
                              </div>
                            )}
                          </div>
                          {mode === "rev" && (
                            <div>
                              <label className="fld">Reviewer rating</label>
                              <div className="rate">
                                {NUM.map((n, i) => (
                                  <RatingRow
                                    key={n}
                                    n={n}
                                    i={i}
                                    selected={c.reviewer === n}
                                    onClick={() => pickReviewer(c.id, n)}
                                  />
                                ))}
                              </div>
                              <div
                                className="field"
                                style={{ marginTop: 8, marginBottom: 0 }}
                              >
                                <label>
                                  Reviewer justification
                                  {c.reviewer != null &&
                                    suggested != null &&
                                    c.reviewer !== suggested && (
                                      <span
                                        style={{
                                          color: "var(--red)",
                                          fontSize: 12,
                                          marginLeft: 6,
                                        }}
                                      >
                                        (a note helps — this differs from the
                                        suggested rating)
                                      </span>
                                    )}
                                </label>
                                <textarea
                                  value={c.rjust}
                                  onChange={(e) =>
                                    updContrib(c.id, "rjust", e.target.value)
                                  }
                                  placeholder="A quick note on why your score is higher or lower."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button className="addbtn" onClick={addContrib}>
                    + Add a contribution
                  </button>
                </div>
                <div className="card">
                  <div className="navbtns">
                    <button className="ghost" onClick={() => goto(1)}>
                      ← Back
                    </button>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button
                        className="pa-save-btn"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Draft saved");
                        }}
                      >
                        💾 Save Draft
                      </button>
                      <button
                        className="primary"
                        onClick={() => gotoValidated(2, 3)}
                      >
                        Next: Team →
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: TEAM ─────────────────────────────────────────────── */}
            {step === 3 && (
              <>
                <div className="card">
                  <h2>
                    Team Contribution{" "}
                    <span className="breakdown" style={{ fontWeight: 400 }}>
                      (20%)
                    </span>
                  </h2>
                  <p className="hint">
                    Add each team contribution separately — mentoring, helping
                    or unblocking others, knowledge sharing, setting standards.
                    The section score is the average of your entries.
                  </p>
                  {topErr && <div className="top-err">{topErr}</div>}
                  {teamEntries.map((e, idx) => (
                    <Fragment key={e.id}>
                      {EntryBlock({ section: "team", e, idx })}
                    </Fragment>
                  ))}
                  <button className="addbtn" onClick={() => addEntry("team")}>
                    + Add a team contribution
                  </button>
                  <div className="hint" style={{ marginTop: 10 }}>
                    Section average:{" "}
                    {tAvg == null ? "—" : tAvg.toFixed(1) + " / 5"}
                  </div>
                </div>
                <div className="card">
                  <div className="navbtns">
                    <button className="ghost" onClick={() => goto(2)}>
                      ← Back
                    </button>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button
                        className="pa-save-btn"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Draft saved");
                        }}
                      >
                        💾 Save Draft
                      </button>
                      <button
                        className="primary"
                        onClick={() => gotoValidated(3, 4)}
                      >
                        Next: Organization →
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 4: ORGANIZATION ─────────────────────────────────────── */}
            {step === 4 && (
              <>
                <div className="card">
                  <h2>
                    Organization Contribution{" "}
                    <span className="breakdown" style={{ fontWeight: 400 }}>
                      (10%)
                    </span>
                  </h2>
                  <p className="hint">
                    Add each organization-level contribution — a tool,
                    automation, framework, process or initiative. It counts when
                    it is in active use or proven working.
                  </p>
                  <div className="note">
                    Counts only if in active use OR proven working — not
                    slideware.
                  </div>
                  {topErr && <div className="top-err">{topErr}</div>}
                  {orgEntries.map((e, idx) => (
                    <Fragment key={e.id}>
                      {EntryBlock({ section: "org", e, idx })}
                    </Fragment>
                  ))}
                  <button className="addbtn" onClick={() => addEntry("org")}>
                    + Add an organization contribution
                  </button>
                  <div className="hint" style={{ marginTop: 10 }}>
                    Section average:{" "}
                    {oAvg == null ? "—" : oAvg.toFixed(1) + " / 5"}
                  </div>
                </div>
                <div className="card">
                  <div className="navbtns">
                    <button className="ghost" onClick={() => goto(3)}>
                      ← Back
                    </button>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button
                        className="pa-save-btn"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Draft saved");
                        }}
                      >
                        💾 Save Draft
                      </button>
                      <button
                        className="primary"
                        onClick={() => gotoValidated(4, 5)}
                      >
                        Next: Culture →
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 5: CULTURE ──────────────────────────────────────────── */}
            {step === 5 && (
              <>
                <div className="card">
                  <h2>
                    Culture &amp; Discipline{" "}
                    <span className="breakdown" style={{ fontWeight: 400 }}>
                      (10%)
                    </span>
                  </h2>
                  <p className="hint">
                    Rate each item 1–5. <span className="req-star">*</span> All
                    items are required. The section score is the average of your
                    answers.
                  </p>
                  {topErr && <div className="top-err">{topErr}</div>}
                  <table className="matrix">
                    <tbody>
                      <tr>
                        <th>Item</th>
                        <th style={{ width: 180 }}>Rating</th>
                      </tr>
                      {CULT_ITEMS.map(([k, label]) => (
                        <tr key={k}>
                          <td>{label}</td>
                          <td>
                            <select
                              className={errCls("b_culture_" + k)}
                              value={cultRatings[k] ?? ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setCultRatings((p) => ({
                                    ...p,
                                    [k]: +e.target.value,
                                  }));
                                } else {
                                  setCultRatings((p) => {
                                    const n = { ...p };
                                    delete n[k];
                                    return n;
                                  });
                                }
                                clearErr("b_culture_" + k);
                                setIsDirty(true);
                              }}
                            >
                              <option value="">Awaiting Rating</option>
                              {SCALE5.map((s, i) => (
                                <option key={i} value={NUM[i]}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <Err k={"b_culture_" + k} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="hint">
                    Section average:{" "}
                    {cAvg == null ? "—" : cAvg.toFixed(1) + " / 5"}
                  </div>
                  <div className="field">
                    <label>
                      Comments / justification{" "}
                      <span className="breakdown">(optional)</span>
                    </label>
                    <textarea
                      value={cultComment}
                      onChange={(e) => {
                        setCultComment(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Anything to add or explain (optional)."
                    />
                  </div>
                </div>
                <div className="card">
                  <div className="navbtns">
                    <button className="ghost" onClick={() => goto(4)}>
                      ← Back
                    </button>
                    <span style={{ display: "flex", gap: 8 }}>
                      <button
                        className="pa-save-btn"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Draft saved");
                        }}
                      >
                        💾 Save Draft
                      </button>
                      <button
                        className="primary"
                        onClick={() => gotoValidated(5, 6)}
                      >
                        Review &amp; Submit →
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 6: REVIEW & SUBMIT ──────────────────────────────────── */}
            {step === 6 && (
              <div className="card" id="pa-print">
                <h2>Review &amp; Submit</h2>

                {/* Score card */}
                <div
                  className="card"
                  style={{ margin: "0 0 16px", background: "#fafdfb" }}
                >
                  <div className="scorebar">
                    <div>
                      <div className="bignum">
                        {totalScore != null ? totalScore.toFixed(2) : "–"}
                      </div>
                      <div className="breakdown">weighted / 5.0</div>
                    </div>
                    <div
                      className="cat"
                      style={{
                        background:
                          displayIdx >= 0 ? CATS[displayIdx].color : "#9ca3af",
                      }}
                    >
                      {totalScore != null && displayIdx >= 0
                        ? CATS[displayIdx].name
                        : "Complete the sections"}
                    </div>
                    <div className="mini-scores">
                      <div className="ms">
                        <span>Individual</span>
                        <b>
                          {ind.avg != null
                            ? ind.anyDown
                              ? ind.avg.toFixed(1) + "*"
                              : ind.avg.toFixed(1)
                            : "–"}
                        </b>
                      </div>
                      <div className="ms">
                        <span>Team</span>
                        <b>{tAvg != null ? tAvg.toFixed(1) : "–"}</b>
                      </div>
                      <div className="ms">
                        <span>Organization</span>
                        <b>{oAvg != null ? oAvg.toFixed(1) : "–"}</b>
                      </div>
                      <div className="ms">
                        <span>Culture</span>
                        <b>{cAvg != null ? cAvg.toFixed(1) : "–"}</b>
                      </div>
                    </div>
                  </div>
                  {warnings.length > 0 && (
                    <div className="warn-box" style={{ marginTop: 12 }}>
                      {warnings.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Nominate peer reviewers (hidden once submitted) ──────── */}
                {mode === "self" && !submitted && (
                  <div className="card no-print" style={{ margin: "0 0 16px" }}>
                    <h3 className="sec" style={{ marginTop: 0 }}>
                      Nominate your peer reviewers
                    </h3>
                    <p className="hint">
                      Pick <b>two colleagues</b> from anywhere in the
                      organisation. They will be asked to complete a short peer
                      review of you
                      {activeCycle ? (
                        <>
                          {" "}
                          for <b>{activeCycle.name}</b>
                        </>
                      ) : null}
                      . Your team lead and leadership see both your
                      self-assessment and their reviews.
                    </p>
                    {!activeCycle && (
                      <div className="note">
                        No review cycle is open right now — your submission is
                        still saved, and reviews can be completed once HR opens
                        a cycle.
                      </div>
                    )}
                    <div style={{ position: "relative", marginBottom: 10 }}>
                      <Search
                        style={{
                          width: 15,
                          height: 15,
                          position: "absolute",
                          left: 11,
                          top: 11,
                          color: "#94a3b8",
                        }}
                      />
                      <input
                        value={reviewerSearch}
                        onChange={(e) => setReviewerSearch(e.target.value)}
                        placeholder="Search colleagues by name…"
                        style={{ paddingLeft: 32 }}
                      />
                    </div>
                    <div className="hint" style={{ marginBottom: 8 }}>
                      {reviewerIds.length} / 2 selected
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: 8,
                        maxHeight: 260,
                        overflowY: "auto",
                      }}
                    >
                      {orgUsers
                        .filter(
                          (u) =>
                            u.id !== user?.id &&
                            u.name
                              .toLowerCase()
                              .includes(reviewerSearch.toLowerCase()),
                        )
                        .map((u) => {
                          const on = reviewerIds.includes(u.id);
                          const disabled = !on && reviewerIds.length >= 2;
                          return (
                            <div
                              key={u.id}
                              onClick={() => !disabled && toggleReviewer(u.id)}
                              className={`facet ${on ? "on" : ""}`}
                              style={{
                                width: "auto",
                                opacity: disabled ? 0.45 : 1,
                                cursor: disabled ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: "50%",
                                  background: u.avatar_color || "#3b82f6",
                                  color: "#fff",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  flex: "0 0 auto",
                                }}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <b
                                  style={{
                                    display: "block",
                                    fontSize: 13,
                                    marginBottom: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {u.name}
                                </b>
                                <span style={{ fontSize: 11 }}>
                                  {u.role || u.department || ""}
                                </span>
                              </span>
                              {on && (
                                <Check
                                  style={{
                                    width: 16,
                                    height: 16,
                                    color: "#4f46e5",
                                    marginLeft: "auto",
                                    flex: "0 0 auto",
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      {orgUsers.length === 0 &&
                        orgUsersStatus === "loading" && (
                          <div className="hint">Loading colleagues…</div>
                        )}
                      {orgUsersStatus === "error" && (
                        <div className="hint">
                          Couldn&apos;t load colleagues.{" "}
                          <button
                            type="button"
                            onClick={loadOrgUsers}
                            style={{
                              color: "var(--accent)",
                              fontWeight: 600,
                              textDecoration: "underline",
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      {orgUsers.length === 0 &&
                        orgUsersStatus === "loaded" && (
                          <div className="hint">No colleagues found.</div>
                        )}
                    </div>
                  </div>
                )}

                <h3 className="sec">Summary</h3>

                <div className="rev-block">
                  <div className="blockhead">
                    <h4>Employee</h4>
                  </div>
                  <div className="sum-grid">
                    <span className="sl">Name</span>
                    <span>
                      <b>{emp || "—"}</b>
                    </span>
                    <span className="sl">Designation</span>
                    <span>{desig || "—"}</span>
                    <span className="sl">Review period</span>
                    <span>{period || "—"}</span>
                    <span className="sl">Filled by</span>
                    <span>
                      {mode === "self" ? "Self" : "Reviewer"}
                      {rev ? ` (${rev})` : ""}
                    </span>
                    <span className="sl">Role areas</span>
                    <span className="chips">
                      {facets.size ? (
                        [...facets].map((k) => (
                          <span key={k} className="chip">
                            {FACETS[k].label}
                          </span>
                        ))
                      ) : (
                        <span>—</span>
                      )}
                    </span>
                  </div>
                  {submitErrors.find((e) => e.step === 1) && (
                    <MissList se={submitErrors.find((e) => e.step === 1)!} />
                  )}
                </div>

                <div className="rev-block">
                  <div className="blockhead">
                    <h4>Individual Contributions</h4>
                    <span className="avg-pill">
                      Average: {ind.avg != null ? `${ind.avg.toFixed(1)} / 5` : "—"}
                    </span>
                  </div>
                  {contributions.length === 0 ? (
                    <div className="kv">No contributions added.</div>
                  ) : (
                    <div className="sum-list">
                      {contributions.map((c, i) => {
                        const { down } = contribEff(c);
                        const { suggested: sugg } = computeSuggested(c);
                        const impLabel = (k: string) =>
                          (IMPACTS.find((x) => x[0] === k) || [k, k])[1];
                        const imps = c.impacts
                          .map(
                            (k) =>
                              impLabel(k) +
                              (c.impactWhy[k] ? " — " + c.impactWhy[k] : ""),
                          )
                          .join("; ");
                        return (
                          <div key={c.id} className="sum-item">
                            <div className="sum-head">
                              <span className="sum-idx">{i + 1}</span>
                              <b className="sum-text">
                                {c.title || "(untitled)"}
                              </b>
                              {c.proofurl ? (
                                <a
                                  className="rb-pill g"
                                  href={c.proofurl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={c.prooffilename || "Open the attached proof"}
                                  style={{ textDecoration: "underline" }}
                                >
                                  Proof ✓ view
                                </a>
                              ) : c.proofref || c.prooffilename ? (
                                <span className="rb-pill g">Proof ✓</span>
                              ) : null}
                            </div>
                            <div className="sum-rates">
                              <span className={`rb-pill${rateTone(c.self)}`}>
                                Self: {rateLabel(c.self)}
                              </span>
                              <span className={`rb-pill${rateTone(sugg)}`}>
                                Suggested: {rateLabel(sugg)}
                              </span>
                              {c.reviewer != null && (
                                <span
                                  className={`rb-pill${rateTone(c.reviewer)}`}
                                >
                                  Reviewer: {rateLabel(c.reviewer)}
                                </span>
                              )}
                            </div>
                            {down && (
                              <div className="sum-sub warn">
                                Exceptional proof incomplete → counts as Exceeds
                              </div>
                            )}
                            {imps && (
                              <div className="sum-sub">Impact: {imps}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {submitErrors.find((e) => e.step === 2) && (
                    <MissList se={submitErrors.find((e) => e.step === 2)!} />
                  )}
                </div>

                <div className="rev-block">
                  <div className="blockhead">
                    <h4>Team Contribution</h4>
                    <span className="avg-pill">
                      Average: {tAvg == null ? "—" : tAvg.toFixed(1) + " / 5"}
                    </span>
                  </div>
                  {teamEntries.length === 0 ? (
                    <div className="kv" style={{ color: "var(--muted)" }}>
                      No entries.
                    </div>
                  ) : (
                    <div className="sum-list">
                      {teamEntries.map((e, i) => (
                        <div key={e.id} className="sum-item">
                          <div className="sum-head">
                            <span className="sum-idx">{i + 1}</span>
                            <span className="sum-text">
                              {e.text || "(no description)"}
                            </span>
                            <span className={`rb-pill${rateTone(e.rating)}`}>
                              {rateLabel(e.rating)}
                            </span>
                          </div>
                          {e.remark && (
                            <div className="sum-sub">Remark: {e.remark}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {submitErrors.find((e) => e.step === 3) && (
                    <MissList se={submitErrors.find((e) => e.step === 3)!} />
                  )}
                </div>

                <div className="rev-block">
                  <div className="blockhead">
                    <h4>Organization Contribution</h4>
                    <span className="avg-pill">
                      Average: {oAvg == null ? "—" : oAvg.toFixed(1) + " / 5"}
                    </span>
                  </div>
                  {orgEntries.length === 0 ? (
                    <div className="kv" style={{ color: "var(--muted)" }}>
                      No entries.
                    </div>
                  ) : (
                    <div className="sum-list">
                      {orgEntries.map((e, i) => (
                        <div key={e.id} className="sum-item">
                          <div className="sum-head">
                            <span className="sum-idx">{i + 1}</span>
                            <span className="sum-text">
                              {e.text || "(no description)"}
                            </span>
                            <span className={`rb-pill${rateTone(e.rating)}`}>
                              {rateLabel(e.rating)}
                            </span>
                          </div>
                          {e.remark && (
                            <div className="sum-sub">Remark: {e.remark}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {submitErrors.find((e) => e.step === 4) && (
                    <MissList se={submitErrors.find((e) => e.step === 4)!} />
                  )}
                </div>

                <div className="rev-block">
                  <div className="blockhead">
                    <h4>Culture &amp; Discipline</h4>
                    <span className="avg-pill">
                      Average: {cAvg == null ? "—" : cAvg.toFixed(1) + " / 5"}
                    </span>
                  </div>
                  {CULT_ITEMS.some(([k]) => cultRatings[k] != null) ? (
                    <div className="cult-grid">
                      {CULT_ITEMS.filter(([k]) => cultRatings[k] != null).map(
                        ([k, l]) => (
                          <div key={k} className="cult-row">
                            <span>{l.split(" — ")[0]}</span>
                            <span
                              className={`rb-pill${rateTone(cultRatings[k])}`}
                            >
                              {cultRatings[k]} / 5
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="kv" style={{ color: "var(--muted)" }}>
                      Not rated yet.
                    </div>
                  )}
                  {cultComment && (
                    <div className="sum-sub" style={{ marginLeft: 0 }}>
                      Comment: {cultComment}
                    </div>
                  )}
                  {submitErrors.find((e) => e.step === 5) && (
                    <MissList se={submitErrors.find((e) => e.step === 5)!} />
                  )}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    borderTop: "1px solid var(--line)",
                    paddingTop: 14,
                  }}
                >
                  <div className="breakdown" style={{ marginBottom: 6 }}>
                    <b>How ratings map to Green / Orange / Red:</b>
                  </div>
                  <div className="map-row">
                    <span className="dot" style={{ background: "#1f9d55" }} />{" "}
                    Exceptional, Exceeds &amp; Meets → <b>&nbsp;Green</b>
                  </div>
                  <div className="map-row">
                    <span className="dot" style={{ background: "#e07b00" }} />{" "}
                    Below Expectation → <b>&nbsp;Orange</b>
                  </div>
                  <div className="map-row">
                    <span className="dot" style={{ background: "#c0392b" }} />{" "}
                    Not Satisfactory → <b>&nbsp;Red</b>
                  </div>
                </div>

                <div className="navbtns" style={{ marginTop: 16 }}>
                  {submitted ? (
                    <span />
                  ) : (
                    <button className="ghost" onClick={() => goto(5)}>
                      ← Back
                    </button>
                  )}
                  <span style={{ display: "flex", gap: 8 }}>
                    {!submitted && (
                      <button
                        className="ghost"
                        onClick={() => {
                          saveDraft();
                          showFlash("💾 Saved on this device.");
                        }}
                      >
                        💾 Save &amp; finish later
                      </button>
                    )}
                    <button className="primary" onClick={() => window.print()}>
                      Print / PDF
                    </button>
                    {submitted ? (
                      hasFullPerformanceAccess ? (
                        <button
                          className="accent-btn"
                          onClick={() => setView("analysis")}
                        >
                          View in Analysis →
                        </button>
                      ) : (
                        <button
                          className="ghost"
                          disabled
                          style={{
                            opacity: 1,
                            color: "#16a34a",
                            borderColor: "#86efac",
                            background: "#f0fdf4",
                          }}
                        >
                          ✓ Submitted
                        </button>
                      )
                    ) : (
                      <button
                        className="accent-btn"
                        onClick={handleSubmitClick}
                        disabled={submitting}
                      >
                        {submitting ? "Submitting…" : "Submit"}
                      </button>
                    )}
                  </span>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
