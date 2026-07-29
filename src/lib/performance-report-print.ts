/**
 * Print document builder for the 360° employee performance report.
 *
 * The on-screen report is a modal inside the app shell (fixed overlay,
 * inner scroller, tabs) — printing that directly is unreliable: browsers
 * clip the scroller, paginate the overlay badly and stamp their own
 * date/URL header and footer. Instead, the Print button builds a fully
 * self-contained A4 document (own markup + CSS, no app styles) with all
 * three review streams, renders it in a hidden iframe and prints that.
 *
 * Page margins: `@page { margin: 0 }` is what suppresses the browser's
 * printed header/footer, so the top/bottom margins are re-created on
 * every sheet by a table scaffold whose thead/tfoot spacer rows repeat
 * on each printed page. Side margins come from padding on the body cell.
 */

import type { EmployeeReport, EmployeeReportPeer } from "./api-client";
import {
  bandColor,
  roleLabel,
  levelLabel,
  fmtScore,
  ratingLabel,
  fmtDate,
  PEER_COMPETENCIES,
  PEER_QUESTIONS,
  PEER_SCALE_LABELS,
  MANAGER_QUESTIONS,
  MANAGER_PARAMETERS,
  IMPACT_LABELS,
  CULT_ITEMS,
  RATING_LABELS,
  type Contribution,
  type Entry,
  type PeerData,
  type AssessmentData,
} from "./performance";

/* ─── Small helpers ─── */

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Colour for a 1–5 rating chip (matches the on-screen report). */
const ratingColor = (n?: number | null): string =>
  n === 5
    ? "#059669"
    : n === 4
      ? "#16a34a"
      : n === 3
        ? "#f59e0b"
        : n != null
          ? "#ef4444"
          : "#64748b";

const chip = (text: string, color: string): string =>
  `<span class="chip" style="color:${color};background:${color}18;border:1px solid ${color}40">${text}</span>`;

const bandChip = (band?: string | null, capped?: boolean): string =>
  chip(esc(band || "Unrated") + (capped ? " ▾" : ""), bandColor(band));

const field = (label: string, value: string): string =>
  `<div class="field"><div class="fk">${esc(label)}</div><div class="fv">${esc(value)}</div></div>`;

const ratingLine = (value: number, gradient: string): string => `
  <div class="rating-line">
    <span class="bar"><i style="width:${(value / 5) * 100}%;background:${gradient}"></i></span>
    <b>${value}/5</b>
    <span class="scale">${esc(PEER_SCALE_LABELS[value - 1] ?? "")}</span>
  </div>`;

const avatar = (name?: string | null, color?: string | null): string =>
  `<span class="avatar" style="background:${esc(color || "#64748b")}">${esc(
    (name || "?").charAt(0).toUpperCase(),
  )}</span>`;

/* ─── Self-assessment stream ─── */

function contributionHtml(c: Contribution, i: number): string {
  const fields: [string, string | undefined][] = [
    ["Context / background", c.context],
    ["Problem statement", c.problem],
    ["What was created / built", c.create],
    ["What was adopted / used by others", c.adopt],
    ["What changed as a result", c.changed],
    ["Business / team value", c.value],
    ["How to sustain this outcome", c.sustain],
    ["Evidence / proof", c.evidence],
  ];
  const body: string[] = fields
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => field(k, v!));

  if (c.proofref?.trim()) {
    const ref = c.proofref.trim();
    const val = /^https?:\/\//i.test(ref)
      ? `<a href="${esc(ref)}">${esc(ref)}</a>`
      : esc(ref);
    body.push(
      `<div class="field"><div class="fk">Proof — reference / link</div><div class="fv">${val}</div></div>`,
    );
  }
  if (c.prooffilename?.trim() || c.proofurl?.trim()) {
    const name = esc(c.prooffilename?.trim() || "Attached file");
    const val = c.proofurl?.trim()
      ? `<a href="${esc(c.proofurl.trim())}">📎 ${name}</a>`
      : `📎 ${name} <span class="dim">(file name only — submitted before uploads were stored)</span>`;
    body.push(
      `<div class="field"><div class="fk">Proof — attached file</div><div class="fv">${val}</div></div>`,
    );
  }
  for (const [k, v] of Object.entries(c.impactWhy ?? {})) {
    if (v?.trim())
      body.push(field(`Impact detail — ${IMPACT_LABELS[k] ?? k}`, v));
  }
  for (const p of c.custom ?? []) {
    if (p.q?.trim() || p.a?.trim())
      body.push(
        field(`Own point — ${p.q?.trim() || "untitled"}`, p.a?.trim() || "—"),
      );
  }
  if (c.rjust?.trim()) body.push(field("Reviewer justification", c.rjust));
  if (body.length === 0)
    body.push(`<p class="empty">No additional detail entered.</p>`);

  const headChips: string[] = [];
  if (c.area)
    headChips.push(`<span class="tag">${esc(roleLabel(c.area))}</span>`);
  if (c.proofref?.trim() || c.prooffilename?.trim())
    headChips.push(`<span class="tag tag-green">📎 Proof attached</span>`);
  if (c.flagged) headChips.push(`<span class="tag tag-red">⚠ Flagged</span>`);

  const impacts = (c.impacts ?? [])
    .map(
      (k) => `<span class="tag tag-grey">${esc(IMPACT_LABELS[k] ?? k)}</span>`,
    )
    .join("");

  const ratings = [
    chip(`Self: ${esc(ratingLabel(c.self))}`, ratingColor(c.self)),
  ];
  if (c.reviewer != null)
    ratings.push(
      chip(
        `Reviewer: ${esc(ratingLabel(c.reviewer))}`,
        ratingColor(c.reviewer),
      ),
    );

  return `
  <div class="contrib">
    <div class="c-head">
      <div class="c-main">
        <div class="c-title-row">
          <span class="c-idx">#${i + 1}</span>
          <span class="c-title">${esc(c.title || `Contribution ${i + 1}`)}</span>
          ${headChips.join("")}
        </div>
        ${impacts ? `<div class="c-tags">${impacts}</div>` : ""}
      </div>
      <div class="c-ratings">${ratings.join("")}</div>
    </div>
    <div class="c-body">${body.join("")}</div>
  </div>`;
}

function entryHtml(e: Entry, i: number): string {
  const rating =
    e.rating != null
      ? chip(
          `${e.rating} — ${RATING_LABELS[e.rating] ?? ""}`,
          ratingColor(e.rating),
        )
      : "";
  return `
  <div class="entry">
    <span class="c-idx">#${i + 1}</span>
    <div class="e-main">
      ${e.text ? `<div class="e-text">${esc(e.text)}</div>` : ""}
      ${e.remark ? `<div class="e-remark">${esc(e.remark)}</div>` : ""}
    </div>
    ${rating}
  </div>`;
}

function selfStreamHtml(
  self: NonNullable<EmployeeReport["self"]>,
  data: AssessmentData,
): string {
  const color = bandColor(self.rating_band);
  const contributions = data.contributions ?? [];
  const teamEntries = data.teamEntries ?? [];
  const orgEntries = data.orgEntries ?? [];
  const cultRatings = data.cultRatings ?? {};
  const gateFlags = data.gateFlags ?? [];

  const pills = (
    [
      ["Individual", self.individual_score],
      ["Team", self.team_score],
      ["Org", self.org_score],
      ["Culture", self.culture_score],
    ] as [string, number | null | undefined][]
  )
    .map(
      ([k, v]) =>
        `<span class="pill"><span class="pv">${fmtScore(v)}</span><span class="pk">${k}</span></span>`,
    )
    .join("");

  const roleChips = (self.role_areas ?? [])
    .map((k) => `<span class="tag">${esc(roleLabel(k))}</span>`)
    .join("");

  const scoreCard = `
  <div class="card avoid-break">
    <div class="score-strip" style="background:${color}0d">
      <div class="big-score">${fmtScore(self.total_score)}<small>weighted / 5.0</small></div>
      ${bandChip(self.rating_band, self.capped)}
      <div class="pills">${pills}</div>
    </div>
    <div class="score-meta">
      <b>${esc(levelLabel(self.career_level))}</b>
      ${roleChips}
      ${self.review_period ? `<span class="meta-right">Period: <b>${esc(self.review_period)}</b></span>` : ""}
    </div>
    ${
      self.severity && self.severity !== "none"
        ? `<div class="warn">⚠ Integrity gate flagged — ${esc(self.severity)}${self.capped ? " · rating capped one band" : ""}</div>`
        : ""
    }
  </div>`;

  const cultureRows = CULT_ITEMS.filter(([k]) => cultRatings[k] != null)
    .map(
      ([k, label]) => `
      <div class="cult-row">
        <span class="cult-label">${esc(label)}</span>
        <span class="bar"><i style="width:${(cultRatings[k] / 5) * 100}%;background:#6366f1"></i></span>
        <span class="cult-val">${cultRatings[k]} — ${RATING_LABELS[cultRatings[k]] ?? ""}</span>
      </div>`,
    )
    .join("");

  return `
  ${scoreCard}

  <div class="sec"><span class="n">①</span> Individual contributions (${contributions.length})</div>
  ${
    contributions.length
      ? contributions.map(contributionHtml).join("")
      : `<p class="empty">No individual contributions were recorded in this submission.</p>`
  }

  <div class="sec"><span class="n" style="color:#3b82f6">②</span> Team impact</div>
  ${
    teamEntries.length
      ? teamEntries.map(entryHtml).join("")
      : `<p class="empty">No team impact entries were recorded in this submission.</p>`
  }

  <div class="sec"><span class="n" style="color:#8b5cf6">③</span> Organisation impact</div>
  ${
    orgEntries.length
      ? orgEntries.map(entryHtml).join("")
      : `<p class="empty">No organisation impact entries were recorded in this submission.</p>`
  }

  ${
    cultureRows
      ? `<div class="sec"><span class="n" style="color:#10b981">④</span> Culture &amp; values</div>
         <div class="card avoid-break" style="padding:10px 14px">
           ${cultureRows}
           ${
             data.cultComment
               ? `<div class="field" style="margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9"><div class="fk">Additional comment</div><div class="fv">${esc(data.cultComment)}</div></div>`
               : ""
           }
         </div>`
      : ""
  }

  ${
    gateFlags.length
      ? `<div class="sec"><span class="n" style="color:#ef4444">⚠</span> Integrity gate — flagged behaviours</div>
         <div class="gate-card avoid-break">${gateFlags
           .map((f) => `<span class="tag tag-red">${esc(f)}</span>`)
           .join("")}</div>`
      : ""
  }`;
}

/* ─── Manager / peer review bodies ─── */

function gateBlockHtml(d: PeerData): string {
  const sev = d.severity ?? "none";
  const label =
    sev === "none"
      ? "No concerns"
      : sev === "concern"
        ? "Concern noted"
        : "Serious concern — rating capped one band";
  const color = sev === "none" ? "#059669" : "#dc2626";
  const flags = (d.gateFlags ?? [])
    .map((f) => `<span class="tag tag-red">${esc(f)}</span>`)
    .join("");
  return `<div style="margin-top:6px">${chip(esc(label), color)}${
    flags ? `<div class="c-tags" style="margin-top:5px">${flags}</div>` : ""
  }</div>`;
}

function reviewBodyHtml(
  d: PeerData,
  gradient: string,
  isManager: boolean,
): string {
  /* Manager questionnaire (rating + narrative per question) */
  const ma = d.managerAnswers;
  if (ma) {
    const knownKeys = new Set<string>(MANAGER_QUESTIONS.map((q) => q.key));
    const blocks = MANAGER_QUESTIONS.filter(
      (q) =>
        (ma[q.key]?.text ?? "").trim() ||
        ma[q.key]?.rating != null ||
        (q.grid && d.parameters) ||
        (q.gate && (d.severity || (d.gateFlags?.length ?? 0) > 0)),
    ).map((q) => {
      let detail = "";
      if (q.grid) {
        detail = MANAGER_PARAMETERS.filter((p) => d.parameters?.[p.key] != null)
          .map(
            (p) => `
            <div class="param-row">
              <span class="param-label">${esc(p.label)}</span>
              <span class="bar"><i style="width:${(d.parameters![p.key] / 5) * 100}%;background:${gradient}"></i></span>
              <b>${d.parameters![p.key]}</b>
            </div>`,
          )
          .join("");
      } else if (q.gate) {
        detail = gateBlockHtml(d);
      } else if (ma[q.key]?.rating != null) {
        detail = ratingLine(ma[q.key]!.rating!, gradient);
      }
      const text = (ma[q.key]?.text ?? "").trim();
      return `
      <div class="qa">
        <div class="qs">${esc(q.short)}</div>
        <div class="qq">${esc(q.question)}</div>
        ${detail}
        ${text ? `<div class="qa-text">${esc(text)}</div>` : ""}
      </div>`;
    });

    /* Answers saved under keys from older questionnaire versions */
    const legacy = Object.entries(ma)
      .filter(
        ([k, v]) =>
          !knownKeys.has(k) && ((v?.text ?? "").trim() || v?.rating != null),
      )
      .map(
        ([k, v]) => `
        <div class="qa">
          <div class="qs">${esc(k)}</div>
          ${v?.rating != null ? ratingLine(v.rating, gradient) : ""}
          ${(v?.text ?? "").trim() ? `<div class="qa-text">${esc(v!.text)}</div>` : ""}
        </div>`,
      );

    const all = [...blocks, ...legacy];
    return all.length
      ? all.join("")
      : `<p class="empty">This review was submitted without readable answers.</p>`;
  }

  /* Peer questionnaire (written answer per question, 1–5 on the overall) */
  const answers = d.answers;
  if (answers) {
    return PEER_QUESTIONS.filter((q) => (answers[q.key] ?? "").trim())
      .map(
        (q) => `
        <div class="qa">
          <div class="qs">${esc(q.short)}</div>
          <div class="qq">${esc(q.question)}</div>
          ${q.scale && d.overall != null ? ratingLine(d.overall, gradient) : ""}
          <div class="qa-text">${esc(answers[q.key])}</div>
        </div>`,
      )
      .join("");
  }

  /* Legacy competency-based review */
  const comps = d.competencies ?? {};
  const compRows = PEER_COMPETENCIES.filter((c) => comps[c.key] != null)
    .map(
      (c) => `
      <div class="param-row">
        <span class="param-label">${esc(c.label)}</span>
        <span class="bar"><i style="width:${(comps[c.key] / 5) * 100}%;background:${gradient}"></i></span>
        <b>${comps[c.key]}</b>
      </div>`,
    )
    .join("");
  const notes: string[] = [];
  if (d.strengths) notes.push(field("Strengths", d.strengths));
  if (d.improvements) notes.push(field("To improve", d.improvements));
  if (isManager && d.comment) notes.push(field("Manager comment", d.comment));
  return `${compRows}${notes.length ? `<div style="margin-top:8px">${notes.join("")}</div>` : ""}`;
}

function reviewCardHtml(
  review: EmployeeReportPeer,
  opts: { isManager: boolean; managerName?: string | null },
): string {
  const d = (review.data ?? {}) as PeerData;
  const submitted = review.status === "submitted";
  const name =
    review.author_name ||
    (opts.isManager
      ? opts.managerName || "Reporting manager"
      : "Peer reviewer");
  const gradient = opts.isManager
    ? "linear-gradient(90deg,#6366f1,#8b5cf6)"
    : "linear-gradient(90deg,#3b82f6,#6366f1)";
  return `
  <div class="review${opts.isManager ? " manager" : ""}">
    <div class="r-head">
      ${avatar(name, review.author_color || (opts.isManager ? "#6366f1" : "#64748b"))}
      <div class="r-who">
        <div class="r-name">${esc(name)}${
          opts.isManager
            ? `<span class="tag" style="margin-left:6px">♛ Manager</span>`
            : ""
        }</div>
        <div class="r-sub">${esc(review.author_role ? `${review.author_role} · ` : "")}${
          submitted
            ? `Submitted ${esc(fmtDate(review.submitted_at || review.created_at))}`
            : "Pending review"
        }</div>
      </div>
      <div class="r-band">${
        submitted
          ? bandChip(review.rating_band, review.capped)
          : chip("Awaiting", "#d97706")
      }</div>
    </div>
    ${
      submitted
        ? reviewBodyHtml(d, gradient, opts.isManager)
        : `<p class="empty">This reviewer hasn&#39;t submitted yet.</p>`
    }
  </div>`;
}

/* ─── Document assembly ─── */

const DOC_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a; font-size: 9.5pt; line-height: 1.5;
  }
  a { color: #4338ca; word-break: break-all; }
  b { font-weight: 700; }

  /* Page scaffold: thead/tfoot spacer rows repeat on every printed sheet,
     recreating the margins that @page{margin:0} removes. */
  table.sheet { width: 100%; border-collapse: collapse; }
  table.sheet > thead td { height: 11mm; }
  table.sheet > tfoot td { height: 9mm; }
  td.page { padding: 0 13mm; vertical-align: top; }

  .avoid-break { break-inside: avoid; }

  /* Masthead */
  .rule { height: 5px; border-radius: 99px; margin-bottom: 13px;
    background: linear-gradient(90deg,#4f46e5,#7c3aed,#2563eb); }
  .mh-top { display: flex; justify-content: space-between; align-items: flex-end;
    gap: 16px; padding-bottom: 9px; border-bottom: 2px solid #1e293b; }
  .brand { font-size: 7pt; font-weight: 800; letter-spacing: .22em;
    text-transform: uppercase; color: #4f46e5; margin-bottom: 3px; }
  h1 { font-size: 16pt; font-weight: 800; margin: 0; letter-spacing: -.01em; }
  .mh-meta { text-align: right; font-size: 8pt; color: #64748b; font-weight: 600; white-space: nowrap; }
  .mh-meta b { color: #1e293b; }
  .identity { display: flex; align-items: center; gap: 11px; padding: 11px 0; }
  .avatar { width: 42px; height: 42px; border-radius: 50%; color: #fff; flex: none;
    font-weight: 700; font-size: 13pt; display: flex; align-items: center; justify-content: center; }
  .r-head .avatar { width: 34px; height: 34px; font-size: 11pt; }
  .who h2 { margin: 0; font-size: 13pt; font-weight: 800; }
  .who p { margin: 2px 0 0; font-size: 8.5pt; color: #64748b; font-weight: 500; }
  .score-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .stat { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 7px; padding: 5px 9px; }
  .stat .k { font-size: 6.5pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: .06em; color: #94a3b8; }
  .stat .v { font-size: 8.5pt; font-weight: 700; color: #1e293b; margin-top: 1px; }

  /* Stream banners — parts 2 and 3 start on a fresh page */
  .part { break-before: page; }
  .part-first { break-before: auto; }
  .banner { display: flex; align-items: center; gap: 10px; padding: 7px 13px;
    border-radius: 8px; color: #fff; margin: 15px 0 11px;
    background: linear-gradient(90deg,#4f46e5,#6d28d9);
    break-after: avoid; break-inside: avoid; }
  .banner .pt { font-size: 7pt; font-weight: 800; letter-spacing: .2em;
    text-transform: uppercase; opacity: .78; }
  .banner .tt { font-size: 10.5pt; font-weight: 800; }
  .banner .nt { margin-left: auto; font-size: 8pt; font-weight: 600; opacity: .88; }

  .sec { display: flex; align-items: center; gap: 6px; margin: 13px 0 7px;
    font-size: 8.5pt; font-weight: 800; text-transform: uppercase;
    letter-spacing: .08em; color: #64748b; break-after: avoid; }
  .sec .n { color: #4f46e5; font-size: 10pt; }

  .chip { display: inline-block; font-size: 8pt; font-weight: 700;
    padding: 2px 9px; border-radius: 99px; white-space: nowrap; }
  .tag { display: inline-block; font-size: 7.5pt; font-weight: 600; color: #4338ca;
    background: #eef2ff; border: 1px solid #e0e7ff; padding: 1px 7px; border-radius: 99px; }
  .tag-green { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
  .tag-red { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
  .tag-grey { color: #64748b; background: #f1f5f9; border-color: #e2e8f0; }

  .card { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
  .score-strip { display: flex; align-items: center; gap: 15px; padding: 9px 14px; flex-wrap: wrap; }
  .big-score { font-size: 18pt; font-weight: 800; line-height: 1; }
  .big-score small { display: block; font-size: 6.5pt; font-weight: 700; color: #94a3b8;
    letter-spacing: .06em; text-transform: uppercase; margin-top: 3px; }
  .pills { display: flex; gap: 15px; margin-left: auto; }
  .pill { text-align: center; }
  .pill .pv { display: block; font-size: 11pt; font-weight: 800; }
  .pill .pk { display: block; font-size: 6.5pt; font-weight: 700; color: #94a3b8;
    text-transform: uppercase; letter-spacing: .06em; }
  .score-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 6px 14px; border-top: 1px solid #f1f5f9; font-size: 8.5pt; color: #475569; }
  .score-meta .meta-right { margin-left: auto; }
  .warn { padding: 6px 14px; background: #fef2f2; border-top: 1px solid #fecaca;
    color: #b91c1c; font-weight: 700; font-size: 8.5pt; }

  .contrib { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 9px; }
  .c-head { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; break-inside: avoid; }
  .c-main { flex: 1; min-width: 0; }
  .c-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .c-idx { color: #94a3b8; font-weight: 800; font-size: 9pt; }
  .c-title { font-weight: 800; font-size: 10pt; }
  .c-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .c-ratings { display: flex; gap: 5px; flex: none; }
  .c-body { border-top: 1px solid #f1f5f9; background: #f8fafc; padding: 9px 12px; }

  .field { margin-bottom: 7px; break-inside: avoid; }
  .field:last-child { margin-bottom: 0; }
  .fk { font-size: 7pt; font-weight: 800; text-transform: uppercase;
    letter-spacing: .06em; color: #94a3b8; margin-bottom: 1px; }
  .fv { color: #334155; white-space: pre-wrap; }
  .dim { color: #94a3b8; font-size: 8pt; }
  .empty { color: #94a3b8; font-size: 9pt; margin: 2px 0 0; }

  .entry { display: flex; align-items: flex-start; gap: 9px; border: 1px solid #e2e8f0;
    border-radius: 9px; padding: 8px 12px; margin-bottom: 7px; break-inside: avoid; }
  .e-main { flex: 1; min-width: 0; }
  .e-text { color: #1e293b; }
  .e-remark { color: #64748b; font-style: italic; font-size: 8.5pt; margin-top: 2px; }

  .cult-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .cult-row:last-child { margin-bottom: 0; }
  .cult-label { flex: 1; color: #334155; font-weight: 500; }
  .cult-val { width: 34mm; text-align: right; font-weight: 700; color: #334155;
    font-size: 8.5pt; white-space: nowrap; }

  .bar { flex: 1; max-width: 55mm; height: 5px; background: #e2e8f0;
    border-radius: 99px; overflow: hidden; display: inline-block; }
  .bar i { display: block; height: 100%; border-radius: 99px; }

  .gate-card { border: 1px solid #fecaca; background: #fef2f2; border-radius: 10px;
    padding: 9px 12px; display: flex; flex-wrap: wrap; gap: 5px; }

  .review { border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; margin-bottom: 9px; }
  .review.manager { border: 2px solid #c7d2fe;
    background: linear-gradient(180deg, rgba(238,242,255,.55), #fff 45%); }
  .r-head { display: flex; align-items: center; gap: 9px; padding-bottom: 7px;
    margin-bottom: 9px; border-bottom: 1px solid #f1f5f9; break-inside: avoid; }
  .r-who { flex: 1; min-width: 0; }
  .r-name { font-weight: 800; font-size: 10pt; }
  .r-sub { font-size: 8pt; color: #94a3b8; font-weight: 500; }
  .r-band { flex: none; }

  .qa { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px;
    padding: 8px 11px; margin-bottom: 6px; break-inside: avoid; }
  .qa:last-child { margin-bottom: 0; }
  .qs { font-size: 7pt; font-weight: 800; text-transform: uppercase;
    letter-spacing: .08em; color: #818cf8; margin-bottom: 1px; }
  .qq { font-size: 8.5pt; font-weight: 600; color: #334155; line-height: 1.4; }
  .qa-text { color: #475569; margin-top: 5px; white-space: pre-wrap; }
  .rating-line { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .rating-line .scale { font-size: 7.5pt; font-weight: 600; color: #94a3b8; }
  .param-row { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
  .param-label { width: 52mm; flex: none; color: #475569; font-weight: 500; font-size: 8.5pt; }

  .doc-foot { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0;
    text-align: center; font-size: 7.5pt; color: #94a3b8; font-weight: 600; }
`;

export function buildReportHtml(report: EmployeeReport): string {
  const subject = report.subject;
  const self = report.self;
  const rawPeers = report.peers ?? [];
  // Mirror the modal: a manager review that arrives inside the reviews list
  // (kind === "manager" or manager-questionnaire data) must not be dropped.
  const manager =
    report.manager ??
    rawPeers.find(
      (p) =>
        p.kind === "manager" ||
        (p.data as PeerData | undefined)?.managerAnswers,
    ) ??
    null;
  const peers = rawPeers.filter((p) => !manager || p.id !== manager.id);
  const data = (self?.data ?? {}) as AssessmentData;
  const submittedPeers = peers.filter((p) => p.status === "submitted").length;
  const printedOn = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const banner = (part: number, title: string, note: string, first = false) => `
  <div class="part${first ? " part-first" : ""}">
    <div class="banner">
      <span class="pt">Part ${part}</span>
      <span class="tt">${esc(title)}</span>
      ${note ? `<span class="nt">${esc(note)}</span>` : ""}
    </div>`;

  const masthead = `
  <div class="rule"></div>
  <div class="mh-top">
    <div>
      <div class="brand">ProjectHub · Confidential</div>
      <h1>Performance Assessment Report</h1>
    </div>
    <div class="mh-meta">
      ${self?.review_period ? `<div>Review period: <b>${esc(self.review_period)}</b></div>` : ""}
      <div>Printed on <b>${esc(printedOn)}</b></div>
    </div>
  </div>
  <div class="identity">
    ${avatar(subject?.name, subject?.avatar_color || "#3b82f6")}
    <div class="who">
      <h2>${esc(subject?.name || "—")}</h2>
      <p>${esc(subject?.role || "—")}${subject?.department ? ` · ${esc(subject.department)}` : ""}${
        subject?.manager_name
          ? ` · Reports to ${esc(subject.manager_name)}`
          : ""
      }</p>
    </div>
    ${
      self
        ? `<div class="score-right">
             <div class="big-score">${fmtScore(self.total_score)}<small>weighted / 5.0</small></div>
             ${bandChip(self.rating_band, self.capped)}
           </div>`
        : ""
    }
  </div>
  <div class="stats">
    <div class="stat"><div class="k">Career level</div><div class="v">${esc(self ? levelLabel(self.career_level) : "—")}</div></div>
    <div class="stat"><div class="k">Role area</div><div class="v">${esc((self?.role_areas ?? []).map(roleLabel).join(", ") || "—")}</div></div>
    <div class="stat"><div class="k">Manager review</div><div class="v">${esc(
      manager?.status === "submitted"
        ? manager.rating_band || "Submitted"
        : "Pending",
    )}</div></div>
    <div class="stat"><div class="k">Peer reviews</div><div class="v">${submittedPeers} of ${peers.length} submitted</div></div>
  </div>`;

  const selfPart = `
  ${banner(1, "Self-assessment", "Submitted by the employee", true)}
    ${self ? selfStreamHtml(self, data) : `<p class="empty">No self-assessment submitted yet.</p>`}
  </div>`;

  const managerPart = `
  ${banner(2, "Manager review — final", manager?.author_name || subject?.manager_name || "")}
    ${
      manager
        ? reviewCardHtml(manager, {
            isManager: true,
            managerName: subject?.manager_name,
          })
        : `<p class="empty">${
            subject?.manager_name
              ? `Awaiting review from ${esc(subject.manager_name)}.`
              : "Manager review pending — assigned once a reporting manager is set."
          }</p>`
    }
  </div>`;

  const peersPart = `
  ${banner(3, "Peer reviews", `${submittedPeers} of ${peers.length} submitted`)}
    ${
      peers.length
        ? peers.map((p) => reviewCardHtml(p, { isManager: false })).join("")
        : `<p class="empty">No peer reviewers nominated yet.</p>`
    }
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Performance Assessment — ${esc(subject?.name || "Report")}</title>
<style>${DOC_CSS}</style>
</head>
<body>
  <table class="sheet">
    <thead><tr><td></td></tr></thead>
    <tbody><tr><td class="page">
      ${masthead}
      ${selfPart}
      ${managerPart}
      ${peersPart}
      <div class="doc-foot">Generated from ProjectHub on ${esc(printedOn)} · Confidential — for internal use only</div>
    </td></tr></tbody>
    <tfoot><tr><td></td></tr></tfoot>
  </table>
</body>
</html>`;
}

/** Render the report document in a hidden iframe and open the print dialog. */
export function printEmployeeReport(report: EmployeeReport): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden;pointer-events:none;";
  iframe.srcdoc = buildReportHtml(report);
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.onafterprint = () => iframe.remove();
    win.focus();
    win.print();
  };
  document.body.appendChild(iframe);
  // Safety net: drop the frame even if afterprint never fires.
  setTimeout(() => iframe.remove(), 120_000);
}
