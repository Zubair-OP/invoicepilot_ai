import { describe, it, expect } from "vitest";
import {
  DEFAULT_REMINDER_OFFSETS,
  addDaysUTC,
  reminderTypeForOffset,
  selectDueReminder,
} from "./reminders.schedule.js";

// A fixed "today" so all date math is deterministic across timezones.
const NOW = new Date("2026-08-05T12:00:00.000Z");

describe("reminderTypeForOffset", () => {
  it("labels upcoming milestones", () => {
    expect(reminderTypeForOffset(-3)).toBe("upcoming_3");
    expect(reminderTypeForOffset(-1)).toBe("upcoming_1");
  });

  it("labels the due milestone", () => {
    expect(reminderTypeForOffset(0)).toBe("due");
  });

  it("labels overdue milestones", () => {
    expect(reminderTypeForOffset(1)).toBe("overdue_1");
    expect(reminderTypeForOffset(7)).toBe("overdue_7");
    expect(reminderTypeForOffset(14)).toBe("overdue_14");
  });
});

describe("addDaysUTC", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysUTC(new Date("2026-08-31T00:00:00.000Z"), 1).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });

  it("subtracts days", () => {
    expect(addDaysUTC(new Date("2026-08-01T00:00:00.000Z"), -1).toISOString()).toBe(
      "2026-07-31T00:00:00.000Z"
    );
  });

  it("preserves the time-of-day component", () => {
    expect(addDaysUTC(new Date("2026-08-05T14:30:00.000Z"), 1).toISOString()).toBe(
      "2026-08-06T14:30:00.000Z"
    );
  });
});

describe("selectDueReminder", () => {
  it("returns null when no milestone has matured yet", () => {
    const due = addDaysUTC(NOW, 10); // due in 10 days; no default milestone has fired
    expect(selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(), NOW)).toBeNull();
  });

  it("returns the upcoming milestone when due is within 3 days", () => {
    const due = addDaysUTC(NOW, 2); // due in 2 days → -3 fires one day ago
    expect(selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(), NOW)).toEqual({
      offset: -3,
      type: "upcoming_3",
    });
  });

  it("returns the most recent matured milestone", () => {
    const due = addDaysUTC(NOW, -15); // due 15 days ago: +14 (=1d ago) and earlier all matured
    expect(selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(), NOW)).toEqual({
      offset: 14,
      type: "overdue_14",
    });
  });

  it("returns null when the most recent milestone was already sent", () => {
    const due = addDaysUTC(NOW, -15);
    expect(
      selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(["overdue_14"]), NOW)
    ).toBeNull();
  });

  it("does not backfill older milestones when the latest was already sent", () => {
    // Due 15 days ago with overdue_14 sent: stays quiet — no overdue_1/7 burst.
    const due = addDaysUTC(NOW, -15);
    expect(
      selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(["overdue_14"]), NOW)
    ).toBeNull();
  });

  it("does not refire an upcoming milestone already sent", () => {
    const due = addDaysUTC(NOW, 2);
    expect(
      selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(["upcoming_3"]), NOW)
    ).toBeNull();
  });

  it("honours custom offsets", () => {
    const due = addDaysUTC(NOW, -2);
    const custom = [-3, -1, 0, 2];
    // Due 2 days ago: -3, -1, 0 all matured; +2 lands exactly on now → most recent.
    expect(selectDueReminder(due, custom, new Set(), NOW)).toEqual({
      offset: 2,
      type: "overdue_2",
    });
  });

  it("never fires future milestones", () => {
    const due = addDaysUTC(NOW, 20); // due well in the future → nothing matured
    expect(selectDueReminder(due, DEFAULT_REMINDER_OFFSETS, new Set(), NOW)).toBeNull();
  });
});