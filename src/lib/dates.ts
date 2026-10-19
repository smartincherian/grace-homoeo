import dayjs from "dayjs";

export function calcAge(dobMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, dayjs(nowMs).diff(dayjs(dobMs), "year"));
}

export function formatDate(ms: number): string {
  return dayjs(ms).format("D MMM YYYY");
}

export function msToDateInput(ms: number): string {
  return dayjs(ms).format("YYYY-MM-DD");
}

export function dateInputToMs(value: string): number {
  return dayjs(value).valueOf();
}

// Calendar-day distance, so a visit at 9 AM yesterday is "Yesterday" at 8 AM today.
export function daysAgoLabel(ms: number, nowMs: number = Date.now()): string {
  const days = dayjs(nowMs)
    .startOf("day")
    .diff(dayjs(ms).startOf("day"), "day");
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 0) return `In ${-days} day${days === -1 ? "" : "s"}`;
  return `${days} days ago`;
}
