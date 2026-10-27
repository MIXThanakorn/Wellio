import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dayKey,
  fromLocal,
  localInput,
  isQuiet,
  reminderState,
  weekStart,
  shiftDay,
} from "../src/lib/dates";
import { csvCell, journalCSV } from "../src/lib/export";
import {
  mealSchema,
  activitySchema,
  checkinSchema,
  waterSchema,
  planSchema,
} from "../src/lib/validation";
import { makeDemo } from "../src/features/journal/demo";
afterEach(() => vi.useRealTimers());
describe("Bangkok calendar boundaries", () => {
  it("groups a UTC evening into the next Bangkok day", () => {
    expect(dayKey("2026-10-26T17:00:00Z")).toBe("2026-10-27");
    expect(dayKey("2026-10-26T16:59:59Z")).toBe("2026-10-26");
  });
  it("interprets user-entered date-time in Bangkok regardless of machine zone", () => {
    expect(fromLocal("2026-10-27T00:30")).toBe("2026-10-26T17:30:00.000Z");
    expect(localInput("2026-10-26T17:30:00Z")).toBe("2026-10-27T00:30");
  });
  it("finds Mondays and shifts across year boundaries", () => {
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
});
describe("reminder consent, quiet hours, and snooze", () => {
  const p = {
    enabled: true,
    meal_gap_minutes: 240,
    quiet_start: "22:00",
    quiet_end: "07:00",
    timezone: "Asia/Bangkok",
    snoozed_until: null,
  };
  const noon = new Date("2026-10-27T05:00:00Z");
  it("never invents a last meal", () =>
    expect(reminderState(p, undefined, noon)).toBe("no-history"));
  it("does not remind until the chosen interval", () => {
    expect(reminderState(p, "2026-10-27T02:00:00Z", noon)).toBe("waiting");
    expect(reminderState(p, "2026-10-27T01:00:00Z", noon)).toBe("due");
  });
  it("respects disable and active snooze", () => {
    expect(
      reminderState({ ...p, enabled: false }, "2026-10-26T01:00:00Z", noon),
    ).toBe("disabled");
    expect(
      reminderState(
        { ...p, snoozed_until: "2026-10-27T06:00:00Z" },
        "2026-10-26T01:00:00Z",
        noon,
      ),
    ).toBe("snoozed");
  });
  it("handles quiet hours across midnight and exact boundaries", () => {
    expect(isQuiet(new Date("2026-10-27T15:00:00Z"), "22:00", "07:00")).toBe(
      true,
    );
    expect(isQuiet(new Date("2026-10-26T23:59:00Z"), "22:00", "07:00")).toBe(
      true,
    );
    expect(isQuiet(new Date("2026-10-27T00:00:00Z"), "22:00", "07:00")).toBe(
      false,
    );
    expect(isQuiet(noon, "22:00", "22:00")).toBe(false);
    expect(isQuiet(noon, "11:00", "13:00")).toBe(true);
  });
  it("new meals and deleting latest meals change the effective interval", () => {
    expect(reminderState(p, "2026-10-27T04:00:00Z", noon)).toBe("waiting");
    expect(reminderState(p, "2026-10-27T00:00:00Z", noon)).toBe("due");
  });
});
describe("input and export protection", () => {
  it("rejects impossible inputs and future check-ins", () => {
    expect(
      waterSchema.safeParse({
        amount_ml: -1,
        consumed_at: new Date().toISOString(),
      }).success,
    ).toBe(false);
    expect(
      activitySchema.safeParse({
        activity_type: "walking",
        duration_minutes: 0,
        started_at: new Date().toISOString(),
        effort: null,
        notes: null,
      }).success,
    ).toBe(false);
    expect(
      checkinSchema.safeParse({
        checkin_date: "2099-01-01",
        weight_kg: 70,
        notes: null,
      }).success,
    ).toBe(false);
    expect(
      planSchema.safeParse({
        title: "test",
        category: "activity",
        days_of_week: [],
        local_time: null,
        duration_minutes: null,
        is_active: true,
      }).success,
    ).toBe(false);
  });
  it("trims meals and keeps optional notes optional", () => {
    const result = mealSchema.parse({
      name: "  ข้าวต้ม  ",
      meal_type: "breakfast",
      eaten_at: new Date().toISOString(),
      portion_text: null,
      notes: null,
    });
    expect(result.name).toBe("ข้าวต้ม");
  });
  it("escapes commas, quotes and spreadsheet formula injection", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("  @cmd")).toBe('"\'  @cmd"');
    expect(journalCSV(makeDemo()).startsWith("\uFEFF")).toBe(true);
  });
});
