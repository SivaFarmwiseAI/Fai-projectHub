/**
 * Performance Review Ratings — Excel export (CEO / HR / Admin).
 *
 * Builds the HR calibration sheet: one row per active employee with the four
 * review ratings (Self, Peer 1, Peer 2, RM), the Calibrated Rating, its
 * percentage form, the percentile rank, and the hike band.
 *
 * Formulas (fixed by HR — do not change without sign-off):
 *   CR                = 0.30·Self + 0.05·Peer1 + 0.05·Peer2 + 0.60·RM   (2 dp)
 *                       — computed only when all four ratings are submitted.
 *   Rating Percentile = (CR / 5) × 100                                   (2 dp)
 *   Percentile        = the hike band from the HR reference table, keyed by
 *                       the Rating Percentile:
 *                       ≥90 → 20–30 · ≥80 → 15–20 · ≥70 → 10–15 ·
 *                       ≥60 → 5–8 · <60 → 0–5 or NIL
 */
import {
  performanceAssessments,
  users as usersApi,
  type PerformanceAssessmentRow,
} from "@/lib/api-client";

const CR_WEIGHTS = { self: 0.3, peer1: 0.05, peer2: 0.05, rm: 0.6 } as const;

const HIKE_BANDS: { minPct: number; rating: string; ratingPct: string; hike: string }[] = [
  { minPct: 90, rating: "4.5 – 5.0", ratingPct: "90% – 100%", hike: "20% – 30%" },
  { minPct: 80, rating: "4.0 – 4.4", ratingPct: "80% – 89%", hike: "15% – 20%" },
  { minPct: 70, rating: "3.5 – 3.9", ratingPct: "70% – 79%", hike: "10% – 15%" },
  { minPct: 60, rating: "3.0 – 3.4", ratingPct: "60% – 69%", hike: "5% – 8%" },
  { minPct: 0, rating: "< 3.0", ratingPct: "< 60%", hike: "0% – 5% or NIL" },
];

export const hikeBandForPct = (pct: number): string =>
  (HIKE_BANDS.find((b) => pct >= b.minPct) ?? HIKE_BANDS[HIKE_BANDS.length - 1]).hike;

interface ExportRow {
  name: string;
  employeeNo: string;
  dateOfJoining: string; // ISO yyyy-mm-dd or ""
  jobTitle: string;
  self: number | null;
  peer1: number | null;
  peer2: number | null;
  rm: number | null;
  cr: number | null;
  ratingPct: number | null;
  /** The hike band from the HR reference table ("5% – 8%", …); "" until CR exists. */
  percentile: string;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v == null || Number.isNaN(n) ? null : n;
};

/** Null-safe cycle equality — assessments without a cycle group together. */
const sameCycle = (a?: string | null, b?: string | null) => (a ?? null) === (b ?? null);

/** Assemble one export row per active employee from the raw assessment list. */
export function buildExportRows(
  employees: {
    id: string;
    name: string;
    role?: string | null;
    is_active?: boolean;
    employee_no?: string | null;
    date_of_joining?: string | null;
  }[],
  assessments: PerformanceAssessmentRow[],
): ExportRow[] {
  const submitted = assessments.filter((a) => a.status === "submitted" && a.subject_user_id);

  const rows: ExportRow[] = employees
    .filter((u) => u.is_active !== false)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((u) => {
      // Latest submitted self-assessment defines the cycle context for the row.
      const self = submitted
        .filter((a) => a.kind === "self" && a.subject_user_id === u.id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

      const peersInCycle = submitted
        .filter(
          (a) =>
            a.kind === "peer" &&
            a.subject_user_id === u.id &&
            (!self || sameCycle(a.cycle_id, self.cycle_id)),
        )
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

      const rmRow = submitted
        .filter(
          (a) =>
            a.kind === "manager" &&
            a.subject_user_id === u.id &&
            (!self || sameCycle(a.cycle_id, self.cycle_id)),
        )
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

      const selfScore = num(self?.total_score);
      const peer1 = num(peersInCycle[0]?.total_score);
      const peer2 = num(peersInCycle[1]?.total_score);
      const rm = num(rmRow?.total_score);

      // CR requires every actor's rating — partial data stays blank rather
      // than silently reweighting.
      let cr: number | null = null;
      let ratingPct: number | null = null;
      if (selfScore != null && peer1 != null && peer2 != null && rm != null) {
        cr = Number(
          (
            selfScore * CR_WEIGHTS.self +
            peer1 * CR_WEIGHTS.peer1 +
            peer2 * CR_WEIGHTS.peer2 +
            rm * CR_WEIGHTS.rm
          ).toFixed(2),
        );
        ratingPct = Number(((cr / 5) * 100).toFixed(2));
      }

      return {
        name: u.name,
        employeeNo: u.employee_no || "",
        // API returns an ISO date/timestamp — keep just the date part.
        dateOfJoining: (u.date_of_joining || "").slice(0, 10),
        jobTitle: u.role || "",
        self: selfScore,
        peer1,
        peer2,
        rm,
        cr,
        ratingPct,
        percentile: ratingPct != null ? hikeBandForPct(ratingPct) : "",
      };
    });

  return rows;
}

/* ─── Workbook construction ─── */

const THIN = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const GREY = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD9D9D9" } };
const ORANGE = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8CBAD" } };

const HEADERS = [
  "Sno", "Employee Number", "Employee Name", "Date of Joining", "Job Title",
  "Self", "Peer 1", "Peer 2", "RM", "CR", "Rating Percentile", "Percentile",
];
const RATING_COL_START = 6; // "Self"
const COL_WIDTHS = [6, 18, 26, 16, 26, 8, 8, 8, 8, 8, 16, 16];

/** Fetches the data, computes every column and downloads the styled .xlsx. */
export async function downloadPerformanceRatingsExcel(): Promise<void> {
  const [{ users }, { assessments }, cycleRes] = await Promise.all([
    usersApi.list(),
    performanceAssessments.list(),
    performanceAssessments.activeCycle().catch(() => ({ cycle: null })),
  ]);

  const rows = buildExportRows(users || [], assessments || []);
  const cycleName = cycleRes.cycle?.name || "";
  const groupTitle = `Performance Review Ratings${cycleName ? ` ${cycleName}` : ""}`;

  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.created = new Date();

  // ── Sheet 1: ratings ──
  // Fully-specified frozen pane: header rows 1–3 stay pinned exactly once and
  // only the data rows scroll (a partial pane spec renders as a split view in
  // Excel, which repeats the header).
  const ws = wb.addWorksheet("Ratings", {
    views: [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 3,
        topLeftCell: "A4",
        activeCell: "A4",
      },
    ],
  });
  COL_WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const LAST = HEADERS.length; // 13 → column M

  // Row 1 — company title
  ws.mergeCells(1, 1, 1, LAST);
  const title = ws.getCell(1, 1);
  title.value = "FarmwiseAI Private Limited";
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  title.fill = GREY;
  ws.getRow(1).height = 26;

  // Rows 2–3 — grouped header: identity columns span both rows, rating
  // columns get the orange group band + individual labels.
  for (let c = 1; c < RATING_COL_START; c++) {
    ws.mergeCells(2, c, 3, c);
    const cell = ws.getCell(2, c);
    cell.value = HEADERS[c - 1];
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  ws.mergeCells(2, RATING_COL_START, 2, LAST);
  const group = ws.getCell(2, RATING_COL_START);
  group.value = groupTitle;
  group.font = { bold: true };
  group.alignment = { horizontal: "center", vertical: "middle" };
  group.fill = ORANGE;
  for (let c = RATING_COL_START; c <= LAST; c++) {
    const cell = ws.getCell(3, c);
    cell.value = HEADERS[c - 1];
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = ORANGE;
  }
  ws.getRow(3).height = 30;

  // Data rows
  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    // Excel-native date so the DOJ column sorts/filters correctly.
    const doj = r.dateOfJoining
      ? new Date(`${r.dateOfJoining}T00:00:00Z`)
      : "";
    row.values = [
      i + 1,
      r.employeeNo,
      r.name,
      doj,
      r.jobTitle,
      r.self ?? "",
      r.peer1 ?? "",
      r.peer2 ?? "",
      r.rm ?? "",
      r.cr ?? "",
      r.ratingPct ?? "",
      r.percentile,
    ];
    for (let c = 1; c <= LAST; c++) {
      const cell = row.getCell(c);
      cell.border = BORDER;
      if (c !== 3 && c !== 5) cell.alignment = { horizontal: "center" };
      if (c === 4 && doj) cell.numFmt = "dd-mmm-yyyy";
    }
  });

  // Borders on the header block
  for (let rIdx = 1; rIdx <= 3; rIdx++) {
    for (let c = 1; c <= LAST; c++) ws.getCell(rIdx, c).border = BORDER;
  }

  // ── Download ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Performance_Review_Ratings${cycleName ? `_${cycleName.replace(/[^\w-]+/g, "_")}` : ""}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
