// Pure scheduling logic for dunning reminders. No I/O, no Mongoose — everything
// here is a deterministic function of its inputs, which is what makes it cheap to
// unit-test and safe to reason about. All date math is done in UTC so a sweep
// produces the same milestones regardless of server timezone or DST.

// Default schedule: 3 days before due (a friendly heads-up), then 1, 7, and 14
// days past due. Offsets are whole days relative to `dueDate`; negative = before.
export const DEFAULT_REMINDER_OFFSETS = [-3, 1, 7, 14];

/**
 * Adds a whole number of calendar days to a date in UTC. Using UTC components
 * (not local time, and not raw millisecond arithmetic across a DST boundary)
 * keeps a "+7 days" milestone landing on the same wall-clock instant every run.
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Stable label for a milestone, derived from its day-offset. This string is what
 * gets recorded in `remindersSent`, so it must be deterministic per offset:
 *   -3 → "upcoming_3"   0 → "due"   7 → "overdue_7"
 */
export function reminderTypeForOffset(offset: number): string {
  if (offset < 0) return `upcoming_${Math.abs(offset)}`;
  if (offset === 0) return "due";
  return `overdue_${offset}`;
}

export interface DueReminder {
  offset: number;
  type: string;
}

/**
 * Decides which single reminder (if any) an invoice is due for right now.
 *
 * The rule is "most recent milestone wins": among all milestones whose date has
 * passed, only the latest one is a candidate. If that latest milestone has
 * already been sent, nothing is sent — we deliberately do NOT backfill older
 * milestones. That prevents an invoice picked up already several days overdue
 * from firing a burst of stale reminders, and after the latest reminder goes out
 * it stays quiet until the next milestone matures.
 *
 * @param alreadySent  set of `type` values already present in `remindersSent`
 */
export function selectDueReminder(
  dueDate: Date,
  offsets: number[],
  alreadySent: ReadonlySet<string>,
  now: Date
): DueReminder | null {
  const nowMs = now.getTime();
  let latest: { offset: number; type: string; at: number } | null = null;

  for (const offset of offsets) {
    const at = addDaysUTC(dueDate, offset).getTime();
    if (at > nowMs) continue; // milestone hasn't matured yet
    if (!latest || at > latest.at) {
      latest = { offset, type: reminderTypeForOffset(offset), at };
    }
  }

  if (!latest) return null;
  if (alreadySent.has(latest.type)) return null; // latest milestone already dunned
  return { offset: latest.offset, type: latest.type };
}
