/** Shared Day/Week/Month/Year window filter used by the team member overview
 *  card and the team delivery board. Offset steps back from now (0 = current,
 *  -1 = previous, …). */

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type Period = "day" | "week" | "month" | "year";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

export function periodWindow(
  period: Period,
  offset: number,
): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (period) {
    case "day": {
      const d = addDays(now, offset);
      return {
        start: startOfDay(d),
        end: endOfDay(d),
        label: offset === 0 ? "Today" : offset === -1 ? "Yesterday" : format(d, "EEE, MMM d, yyyy"),
      };
    }
    case "week": {
      const d = addWeeks(now, offset);
      const start = startOfWeek(d, { weekStartsOn: 1 });
      const end = endOfWeek(d, { weekStartsOn: 1 });
      return {
        start,
        end,
        label:
          offset === 0
            ? "This week"
            : offset === -1
              ? "Last week"
              : `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      };
    }
    case "month": {
      const d = addMonths(now, offset);
      return {
        start: startOfMonth(d),
        end: endOfMonth(d),
        label: offset === 0 ? "This month" : format(d, "MMMM yyyy"),
      };
    }
    case "year": {
      const d = addYears(now, offset);
      return {
        start: startOfYear(d),
        end: endOfYear(d),
        label: offset === 0 ? "This year" : format(d, "yyyy"),
      };
    }
  }
}
