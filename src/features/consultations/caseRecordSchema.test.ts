import { describe, expect, it } from "vitest";
import {
  EMPTY_GENERALS,
  generalsSchema,
  isGeneralsBlank,
  isLsmcRowBlank,
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
