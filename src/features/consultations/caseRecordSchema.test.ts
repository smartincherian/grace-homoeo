import { describe, expect, it } from "vitest";
import {
  EMPTY_GENERALS,
  generalsEqual,
  generalsSchema,
  isGeneralsBlank,
  isLsmcRowBlank,
  toBaseline,
  type GeneralsRecord,
} from "./caseRecordSchema";

describe("generalsSchema", () => {
  it("defaults every field to empty", () => {
    expect(generalsSchema.parse({})).toEqual(EMPTY_GENERALS);
    expect(EMPTY_GENERALS.lmp).toBeNull();
    expect(EMPTY_GENERALS.thirst).toBe("");
  });
});

describe("isGeneralsBlank", () => {
  it("is true for empty generals", () => {
    expect(isGeneralsBlank(EMPTY_GENERALS)).toBe(true);
  });
  it("ignores whitespace-only values", () => {
    expect(isGeneralsBlank({ ...EMPTY_GENERALS, thirst: "  " })).toBe(true);
  });
  it("counts an LMP date as a value", () => {
    expect(isGeneralsBlank({ ...EMPTY_GENERALS, lmp: 1 })).toBe(false);
  });
});

describe("isLsmcRowBlank", () => {
  const blank = { location: "", sensation: " ", modality: "", concomitant: "" };
  it("is true when all four cells are blank", () => {
    expect(isLsmcRowBlank(blank)).toBe(true);
  });
  it("is false when any cell has text", () => {
    expect(isLsmcRowBlank({ ...blank, location: "head" })).toBe(false);
  });
});

describe("generalsEqual", () => {
  it("compares trimmed strings", () => {
    expect(
      generalsEqual(
        { ...EMPTY_GENERALS, thirst: "low " },
        { ...EMPTY_GENERALS, thirst: "low" },
      ),
    ).toBe(true);
  });
  it("detects a different LMP", () => {
    expect(
      generalsEqual(
        { ...EMPTY_GENERALS, lmp: 1 },
        { ...EMPTY_GENERALS, lmp: 2 },
      ),
    ).toBe(false);
  });
});

describe("toBaseline", () => {
  it("strips record metadata and clears LMP", () => {
    const rec: GeneralsRecord = {
      ...EMPTY_GENERALS,
      lmp: 5,
      thirst: "low",
      id: "c1",
      patientId: "p1",
      consultationId: "c1",
      date: 1,
      updatedAt: 1,
    };
    const base = toBaseline(rec);
    expect(base.lmp).toBeNull();
    expect(base.thirst).toBe("low");
    expect(base).not.toHaveProperty("patientId");
  });
  it("is empty generals when there is no record", () => {
    expect(toBaseline(null)).toEqual(EMPTY_GENERALS);
  });
});
