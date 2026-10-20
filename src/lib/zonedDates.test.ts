import { describe, expect, test } from "vitest";
import {
  addDaysInZone,
  dateInputToZonedMs,
  dayStartInZone,
  daysBetweenInclusive,
  formatMonth,
  formatZonedDate,
  monthKeyOf,
  monthRange,
  formatZonedTime,
  weekdayKeyOf,
  zonedMsToDateInput,
  zonedTimeToMs,
} from "./zonedDates";

const TZ = "Asia/Kolkata";

describe("zonedDates", () => {
  test("dateInputToZonedMs gives the clinic-zone day start", () => {
    expect(dateInputToZonedMs("2026-02-01", TZ)).toBe(
      Date.UTC(2026, 0, 31, 18, 30),
    );
    expect(zonedMsToDateInput(Date.UTC(2026, 0, 31, 18, 30), TZ)).toBe(
      "2026-02-01",
    );
  });
  test("monthRange is the Kolkata month", () => {
    expect(monthRange("2026-02", TZ)).toEqual({
      start: Date.UTC(2026, 0, 31, 18, 30),
      end: Date.UTC(2026, 1, 28, 18, 30) - 1,
      days: 28,
    });
    expect(monthRange("2024-02", TZ).days).toBe(29);
  });
  test("monthKeyOf uses the zone, not UTC", () => {
    // 2026-01-31 20:00 UTC is already 1 Feb in Kolkata
    expect(monthKeyOf(Date.UTC(2026, 0, 31, 20, 0), TZ)).toBe("2026-02");
  });
  test("dayStartInZone, addDaysInZone, daysBetweenInclusive", () => {
    const d = dateInputToZonedMs("2026-01-30", TZ);
    expect(dayStartInZone(d + 5 * 3600_000, TZ)).toBe(d);
    expect(addDaysInZone(d, 3, TZ)).toBe(dateInputToZonedMs("2026-02-02", TZ));
    expect(daysBetweenInclusive(d, addDaysInZone(d, 3, TZ), TZ)).toBe(4);
    expect(daysBetweenInclusive(addDaysInZone(d, 1, TZ), d, TZ)).toBe(0);
  });
  test("formatZonedDate", () => {
    expect(formatZonedDate(Date.UTC(2026, 0, 31, 20, 0), TZ)).toBe(
      "1 Feb 2026",
    );
  });
  test("formatMonth", () => expect(formatMonth("2026-02")).toBe("Feb 2026"));
});

describe("clinic-zone time helpers", () => {
  const TZ = "Asia/Kolkata";
  const day = dateInputToZonedMs("2026-11-02", TZ);
  test("zonedTimeToMs and weekdayKeyOf use the clinic zone", () => {
    expect(zonedTimeToMs(day, "09:30", TZ)).toBe(Date.UTC(2026, 10, 2, 4, 0));
    expect(weekdayKeyOf(Date.UTC(2026, 10, 1, 19, 0), TZ)).toBe("mon");
    expect(formatZonedTime(Date.UTC(2026, 10, 2, 4, 0), TZ)).toBe("9:30 AM");
  });
});
