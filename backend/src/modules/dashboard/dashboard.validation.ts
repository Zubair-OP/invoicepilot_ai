import { z } from "zod";

// Max window a dashboard request may span. Guards the daily "over time" buckets
// against a query like from=2000&to=2100 that would otherwise materialise tens
// of thousands of entries. 366 days covers a year plus a leap day.
const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ISO-8601 timestamps with an offset (e.g. 2026-08-01T00:00:00Z). Dates are
// validated at the API boundary so `resolveDashboardRange` only ever sees sane
// input.
export const dashboardRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .superRefine((value, ctx) => {
    const now = Date.now();
    const from = value.from ? new Date(value.from).getTime() : undefined;
    const to = value.to ? new Date(value.to).getTime() : undefined;

    if (from !== undefined && to !== undefined) {
      if (from >= to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before to", path: ["from"] });
      } else if (to - from > MAX_RANGE_DAYS * MS_PER_DAY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `range cannot exceed ${MAX_RANGE_DAYS} days`,
          path: ["from"],
        });
      }
    } else if (from !== undefined && from > now) {
      // With `to` omitted the resolved end defaults to now, so a future `from`
      // would silently invert the range into an empty result.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must not be in the future when to is omitted",
        path: ["from"],
      });
    }
  });

export interface DashboardRange {
  from: Date;
  to: Date;
}

/**
 * Resolves a validated ?from=/?to= into a half-open range [from, to). Defaults to
 * the last 30 days when either side is omitted. All boundary math is UTC.
 */
export function resolveDashboardRange(from?: string, to?: string): DashboardRange {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * MS_PER_DAY);
  return { from: fromDate, to: toDate };
}
