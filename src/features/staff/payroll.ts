import {
  addDaysInZone,
  dayStartInZone,
  daysBetweenInclusive,
  monthKeyOf,
  monthRange,
} from "../../lib/zonedDates";
import { LEAVE_TYPES, type Leave, type LeaveType, type Staff } from "./staffSchema";

type LeaveSpan = Pick<Leave, "from" | "to" | "halfDay">;
type LeaveLike = LeaveSpan & Pick<Leave, "type">;

/** Days of the month the person was employed (joined/left clipped), in the clinic zone. */
function employedRange(
  staff: Pick<Staff, "joinedOn" | "leftOn">,
  month: string,
  tz: string,
) {
  const { start, end, days } = monthRange(month, tz);
  const lastDay = dayStartInZone(end, tz);
  const lo = Math.max(start, dayStartInZone(staff.joinedOn, tz));
  const hi = Math.min(
    lastDay,
    staff.leftOn == null ? lastDay : dayStartInZone(staff.leftOn, tz),
  );
  return { lo, hi, days, employedDays: daysBetweenInclusive(lo, hi, tz) };
}

export function employedDaysInMonth(
  staff: Pick<Staff, "joinedOn" | "leftOn">,
  month: string,
  tz: string,
): number {
  return employedRange(staff, month, tz).employedDays;
}

/** Days of a leave inside [rangeFrom, rangeTo] (day starts, inclusive); a half day counts 0.5. */
export function leaveDaysInRange(
  leave: LeaveSpan,
  rangeFrom: number,
  rangeTo: number,
  tz: string,
): number {
  const overlap = daysBetweenInclusive(
    Math.max(leave.from, rangeFrom),
    Math.min(leave.to, rangeTo),
    tz,
  );
  return leave.halfDay && overlap === 1 ? 0.5 : overlap;
}

export interface PayrollLine {
  month: string;
  base: number;
  paidDays: number;
  unpaidDays: number;
  deduction: number;
  adjustment: number;
  net: number;
  employedDays: number;
  daysInMonth: number;
}

export function computePayroll(
  staff: Pick<Staff, "joinedOn" | "leftOn" | "monthlySalary">,
  leaves: LeaveLike[],
  month: string,
  tz: string,
  adjustment = 0,
): PayrollLine {
  const { lo, hi, days, employedDays } = employedRange(staff, month, tz);
  const unpaidRaw = leaves
    .filter((l) => l.type === "Unpaid")
    .reduce((sum, l) => sum + leaveDaysInRange(l, lo, hi, tz), 0);
  const unpaidDays = Math.min(employedDays, unpaidRaw);
  const base = Math.round((staff.monthlySalary * employedDays) / days);
  const deduction = Math.round((staff.monthlySalary / days) * unpaidDays);
  return {
    month,
    base,
    paidDays: employedDays - unpaidDays,
    unpaidDays,
    deduction,
    adjustment,
    net: base - deduction + adjustment,
    employedDays,
    daysInMonth: days,
  };
}

/** Ascending YYYY-MM keys of every month touched by [from, to]. */
export function monthsSpanned(from: number, to: number, tz: string): string[] {
  const out: string[] = [];
  let cur = monthKeyOf(from, tz);
  const last = monthKeyOf(to, tz);
  while (cur <= last) {
    out.push(cur);
    const { end } = monthRange(cur, tz);
    cur = monthKeyOf(addDaysInZone(dayStartInZone(end, tz), 1, tz), tz);
  }
  return out;
}

export function leaveTotalsForYear(
  leaves: LeaveLike[],
  year: number,
  tz: string,
): Record<LeaveType, number> {
  const first = monthRange(`${year}-01`, tz).start;
  const last = dayStartInZone(monthRange(`${year}-12`, tz).end, tz);
  const totals = Object.fromEntries(LEAVE_TYPES.map((t) => [t, 0])) as Record<LeaveType, number>;
  for (const l of leaves) totals[l.type] += leaveDaysInRange(l, first, last, tz);
  return totals;
}
