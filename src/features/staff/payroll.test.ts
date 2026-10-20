import { describe, expect, test } from "vitest";
import { dateInputToZonedMs } from "../../lib/zonedDates";
import { computePayroll, leaveTotalsForYear, monthsSpanned } from "./payroll";

const TZ = "Asia/Kolkata";
const d = (s: string) => dateInputToZonedMs(s, TZ);

describe("payroll", () => {
  test("a fully unpaid 31-day month nets exactly zero", () => {
    const l = [{ from: d("2026-01-01"), to: d("2026-01-31"), halfDay: false, type: "Unpaid" as const }];
    expect(
      computePayroll({ joinedOn: d("2025-01-01"), leftOn: null, monthlySalary: 10000 }, l, "2026-01", TZ),
    ).toMatchObject({ base: 10000, deduction: 10000, net: 0 });
  });

  test("full month, no leave", () => {
    expect(
      computePayroll({ joinedOn: d("2025-01-01"), leftOn: null, monthlySalary: 30000 }, [], "2026-02", TZ),
    ).toMatchObject({ base: 30000, unpaidDays: 0, deduction: 0, net: 30000, paidDays: 28, employedDays: 28, daysInMonth: 28 });
  });
  test("mid-month joiner with unpaid and half-day leave plus adjustment", () => {
    const leaves = [
      { from: d("2026-02-20"), to: d("2026-02-21"), halfDay: false, type: "Unpaid" as const },
      { from: d("2026-02-25"), to: d("2026-02-25"), halfDay: true, type: "Unpaid" as const },
      { from: d("2026-02-26"), to: d("2026-02-26"), halfDay: false, type: "Casual" as const },
    ];
    expect(
      computePayroll({ joinedOn: d("2026-02-15"), leftOn: null, monthlySalary: 30000 }, leaves, "2026-02", TZ, 500),
    ).toMatchObject({ employedDays: 14, base: 15000, unpaidDays: 2.5, deduction: 2679, paidDays: 11.5, adjustment: 500, net: 12821 });
  });
  test("leave spanning months is split per month", () => {
    const s = { joinedOn: d("2025-01-01"), leftOn: null, monthlySalary: 31000 };
    const l = [{ from: d("2026-01-30"), to: d("2026-02-02"), halfDay: false, type: "Unpaid" as const }];
    expect(computePayroll(s, l, "2026-01", TZ)).toMatchObject({ unpaidDays: 2, deduction: 2000 });
    expect(computePayroll(s, l, "2026-02", TZ)).toMatchObject({ unpaidDays: 2, deduction: 2214 });
  });
  test("leave outside employment is ignored; leaver is prorated", () => {
    const l = [{ from: d("2026-02-10"), to: d("2026-02-16"), halfDay: false, type: "Unpaid" as const }];
    expect(computePayroll({ joinedOn: d("2026-02-15"), leftOn: null, monthlySalary: 28000 }, l, "2026-02", TZ).unpaidDays).toBe(2);
    expect(
      computePayroll({ joinedOn: d("2025-01-01"), leftOn: d("2026-02-07"), monthlySalary: 28000 }, [], "2026-02", TZ),
    ).toMatchObject({ employedDays: 7, base: 7000 });
  });
  test("no employed days gives a zero line", () => {
    expect(
      computePayroll({ joinedOn: d("2026-03-01"), leftOn: null, monthlySalary: 28000 }, [], "2026-02", TZ),
    ).toMatchObject({ employedDays: 0, base: 0, net: 0 });
  });
  test("monthsSpanned", () => {
    expect(monthsSpanned(d("2025-12-30"), d("2026-02-02"), TZ)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
  test("yearly leave totals split at the year boundary", () => {
    const l = [
      { from: d("2025-12-30"), to: d("2026-01-02"), halfDay: false, type: "Casual" as const },
      { from: d("2026-03-05"), to: d("2026-03-05"), halfDay: true, type: "Sick" as const },
    ];
    expect(leaveTotalsForYear(l, 2026, TZ)).toEqual({ Casual: 2, Sick: 0.5, Unpaid: 0 });
    expect(leaveTotalsForYear(l, 2025, TZ)).toEqual({ Casual: 2, Sick: 0, Unpaid: 0 });
  });
});
