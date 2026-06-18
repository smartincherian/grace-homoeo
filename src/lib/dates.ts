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
