import { describe, expect, test } from "vitest";
import {
  DEFAULT_SCHEDULE,
  hasHours,
  holidayOn,
  offGridAppointments,
  parseSchedule,
  scheduleSchema,
  slotsForDay,
  type Session,
} from "./schedule";
import {
  addDaysInZone,
  dateInputToZonedMs,
  formatZonedTime,
  zonedTimeToMs,
} from "./zonedDates";

const TZ = "Asia/Kolkata";
const day = dateInputToZonedMs("2026-11-02", TZ); // Monday
const s = {
  ...DEFAULT_SCHEDULE,
  slotMinutes: 15,
  weekly: {
    ...DEFAULT_SCHEDULE.weekly,
    mon: [
      { start: "09:30", end: "10:10" },
      { start: "16:00", end: "16:30" },
    ],
  },
};

describe("schedule", () => {
  test("slotsForDay steps by slotMinutes and drops a short tail", () => {
    expect(
      slotsForDay(day, s, TZ).map((x) => formatZonedTime(x.start, TZ)),
    ).toEqual(["9:30 AM", "9:45 AM", "4:00 PM", "4:15 PM"]);
    expect(slotsForDay(addDaysInZone(day, 1, TZ), s, TZ)).toEqual([]);
  });
  test("holidays close the day unless ignored", () => {
    const h = { ...s, holidays: [{ date: day, note: "Diwali" }] };
    expect(slotsForDay(day, h, TZ)).toEqual([]);
    expect(slotsForDay(day, h, TZ, { ignoreHolidays: true })).toHaveLength(4);
    expect(holidayOn(day, h)?.note).toBe("Diwali");
  });
  test("offGridAppointments", () => {
    const at = (hhmm: string, min: number) => {
      const start = zonedTimeToMs(day, hhmm, TZ);
      return { start, end: start + min * 60_000 };
    };
    const twenty = { ...s, slotMinutes: 20 };
    expect(
      offGridAppointments([at("09:30", 15), at("09:45", 15)], s, TZ),
    ).toEqual([]);
    expect(offGridAppointments([at("09:30", 15)], twenty, TZ)).toEqual([
      at("09:30", 15),
    ]);
    expect(
      offGridAppointments(
        [at("09:45", 15)],
        { ...s, holidays: [{ date: day, note: "" }] },
        TZ,
      ),
    ).toEqual([]);
  });
  test("scheduleSchema rejects bad sessions", () => {
    const bad = (mon: Session[]) =>
      scheduleSchema.safeParse({ ...s, weekly: { ...s.weekly, mon } }).success;
    expect(bad([{ start: "10:00", end: "09:00" }])).toBe(false);
    expect(
      bad([
        { start: "09:00", end: "11:00" },
        { start: "10:00", end: "12:00" },
      ]),
    ).toBe(false);
    expect(bad([{ start: "9:00", end: "11:00" }])).toBe(false);
    expect(scheduleSchema.safeParse(s).success).toBe(true);
  });
  test("scheduleSchema limits sessions, slot length, holidays", () => {
    const w = (mon: Session[]) => ({ ...s, weekly: { ...s.weekly, mon } });
    const four = [0, 1, 2, 3].map((i) => ({
      start: `0${i * 2}:00`,
      end: `0${i * 2 + 1}:00`,
    }));
    expect(scheduleSchema.safeParse(w(four)).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...s, slotMinutes: 4 }).success).toBe(
      false,
    );
    expect(scheduleSchema.safeParse({ ...s, slotMinutes: 121 }).success).toBe(
      false,
    );
    expect(
      scheduleSchema.safeParse({
        ...s,
        holidays: [{ date: day, note: "x".repeat(61) }],
      }).success,
    ).toBe(false);
  });
  test("parseSchedule fills defaults; hasHours", () => {
    expect(parseSchedule(undefined)).toEqual(DEFAULT_SCHEDULE);
    expect(
      parseSchedule({
        slotMinutes: 20,
        weekly: { mon: [{ start: "09:00", end: "10:00" }] },
      }).weekly.tue,
    ).toEqual([]);
    expect(hasHours(DEFAULT_SCHEDULE)).toBe(false);
    expect(hasHours(s)).toBe(true);
  });
});
