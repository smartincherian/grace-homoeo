import { describe, expect, it } from "vitest";
import { calcAge, formatDate, msToDateInput, dateInputToMs } from "./dates";

const ms = (s: string) => dateInputToMs(s);

describe("calcAge", () => {
  it("returns whole years between dob and now", () => {
    expect(calcAge(ms("2000-01-01"), ms("2026-01-01"))).toBe(26);
  });
  it("does not count an unreached birthday this year", () => {
    expect(calcAge(ms("2000-12-31"), ms("2026-06-17"))).toBe(25);
  });
  it("never returns negative for a future dob", () => {
    expect(calcAge(ms("2030-01-01"), ms("2026-01-01"))).toBe(0);
  });
});

describe("formatDate", () => {
  it("formats epoch ms as D MMM YYYY", () => {
    expect(formatDate(ms("2026-06-17"))).toBe("17 Jun 2026");
  });
});

describe("date <-> input round trip", () => {
  it("msToDateInput then dateInputToMs is stable", () => {
    const start = ms("2024-02-29");
    expect(dateInputToMs(msToDateInput(start))).toBe(start);
  });
});
