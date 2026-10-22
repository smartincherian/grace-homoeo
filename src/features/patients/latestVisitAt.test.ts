import { describe, expect, it } from "vitest";
import { latestVisitAt } from "./latestVisitAt";

describe("latestVisitAt", () => {
  it("is null with no visits", () => {
    expect(latestVisitAt([])).toBeNull();
  });
  it("takes the max createdAt", () => {
    expect(latestVisitAt([{ createdAt: 1 }, { createdAt: 5 }])).toBe(5);
  });
  it("falls back to date when createdAt is missing (legacy visit)", () => {
    expect(
      latestVisitAt([{ createdAt: 3, date: 1 }, { date: 9 }] as never),
    ).toBe(9);
  });
  it("ignores non-finite values", () => {
    expect(latestVisitAt([{ createdAt: NaN }, { createdAt: 4 }, {}])).toBe(4);
  });
});
