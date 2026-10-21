import { describe, expect, it } from "vitest";
import { EMPTY_GENERALS } from "./caseRecordSchema";
import {
  GENERALS_GROUPS,
  generalsGroupsFor,
  hasShownGenerals,
} from "./generalsFields";

const keys = (homoeo: boolean) =>
  generalsGroupsFor(homoeo).flatMap((g) => g.fields.map((f) => f.key));

describe("generalsGroupsFor", () => {
  it("keeps every homoeo field for homoeo clinics", () => {
    expect(generalsGroupsFor(true)).toEqual(GENERALS_GROUPS);
    expect(keys(true)).toContain("mentals");
  });

  it("drops mentals and perspiration for general clinics", () => {
    const groups = generalsGroupsFor(false);
    expect(groups.map((g) => g.title)).not.toContain("Perspiration");
    expect(keys(false)).not.toContain("mentals");
    expect(keys(false)).not.toContain("perspirationOdour");
    expect(keys(false)).toEqual(
      expect.arrayContaining([
        "appetite",
        "lmp",
        "pastHistory",
        "allergicHistory",
      ]),
    );
  });

  it("calls sleep just Sleep for general clinics", () => {
    const sleep = (homoeo: boolean) =>
      generalsGroupsFor(homoeo)
        .flatMap((g) => g.fields)
        .find((f) => f.key === "sleepDreams")?.label;
    expect(sleep(false)).toBe("Sleep");
    expect(sleep(true)).toBe("Sleep & dreams");
  });
});

describe("hasShownGenerals", () => {
  it("ignores fields the clinic does not show", () => {
    const g = { ...EMPTY_GENERALS, mentals: "anxious" };
    expect(hasShownGenerals(g, true)).toBe(true);
    expect(hasShownGenerals(g, false)).toBe(false);
    expect(hasShownGenerals({ ...EMPTY_GENERALS, lmp: 5 }, false)).toBe(true);
    expect(hasShownGenerals(EMPTY_GENERALS, true)).toBe(false);
  });
});
