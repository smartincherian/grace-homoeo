import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import type { Weekday } from "./schedule";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/** First ms of the calendar day containing `ms`, in `tz`. */
export function dayStartInZone(ms: number, tz: string): number {
  return dayjs(ms).tz(tz).startOf("day").valueOf();
}

/** "YYYY-MM" of `ms` as seen in `tz`. */
export function monthKeyOf(ms: number, tz: string): string {
  return dayjs(ms).tz(tz).format("YYYY-MM");
}

export function monthRange(
  month: string,
  tz: string,
): { start: number; end: number; days: number } {
  const first = dayjs.tz(`${month}-01`, tz);
  const next = first.add(1, "month");
  return {
    start: first.valueOf(),
    end: next.valueOf() - 1,
    days: first.daysInMonth(),
  };
}

export function addDaysInZone(
  dayStartMs: number,
  n: number,
  tz: string,
): number {
  return dayjs(dayStartMs).tz(tz).add(n, "day").startOf("day").valueOf();
}

/** Calendar days from `fromDayStart` to `toDayStart`, both included; 0 when to < from. */
export function daysBetweenInclusive(
  fromDayStart: number,
  toDayStart: number,
  tz: string,
): number {
  if (toDayStart < fromDayStart) return 0;
  const from = dayjs(fromDayStart).tz(tz).startOf("day");
  const to = dayjs(toDayStart).tz(tz).startOf("day");
  // Compare as UTC calendar dates so DST shifts can't skew the count.
  const diff = dayjs
    .utc(to.format("YYYY-MM-DD"))
    .diff(dayjs.utc(from.format("YYYY-MM-DD")), "day");
  return diff + 1;
}

/** "YYYY-MM-DD" -> that day's start in `tz`. */
export function dateInputToZonedMs(value: string, tz: string): number {
  return dayjs.tz(value, tz).valueOf();
}

export function zonedMsToDateInput(ms: number, tz: string): string {
  return dayjs(ms).tz(tz).format("YYYY-MM-DD");
}

export function formatZonedDate(ms: number, tz: string): string {
  return dayjs(ms).tz(tz).format("D MMM YYYY");
}

/** "2026-02" -> "Feb 2026". */
export function formatMonth(month: string): string {
  return dayjs(`${month}-01`).format("MMM YYYY");
}

const WEEKDAY_BY_DOW: Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** `hhmm` ("HH:mm") on the clinic-zone day starting at `dayStartMs`, as epoch ms. */
export function zonedTimeToMs(
  dayStartMs: number,
  hhmm: string,
  tz: string,
): number {
  return dayjs
    .tz(`${zonedMsToDateInput(dayStartMs, tz)} ${hhmm}`, "YYYY-MM-DD HH:mm", tz)
    .valueOf();
}

/** Weekday of `ms` as seen in `tz`. */
export function weekdayKeyOf(ms: number, tz: string): Weekday {
  return WEEKDAY_BY_DOW[dayjs(ms).tz(tz).day()];
}

/** "9:30 AM" of `ms` as seen in `tz`. */
export function formatZonedTime(ms: number, tz: string): string {
  return dayjs(ms).tz(tz).format("h:mm A");
}
