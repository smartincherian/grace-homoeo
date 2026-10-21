import { describe, expect, it } from "vitest";
import {
  CLINIC_TYPES,
  clinicFeatures,
  clinicTypeLabel,
  parseClinicType,
} from "./clinicType";

describe("parseClinicType", () => {
  it("treats missing or unknown values as homoeo", () => {
    expect(parseClinicType(undefined)).toBe("homoeo");
    expect(parseClinicType("dental")).toBe("homoeo");
    expect(parseClinicType(3)).toBe("homoeo");
  });

  it("keeps known types", () => {
    expect(parseClinicType("general")).toBe("general");
    expect(parseClinicType("homoeo")).toBe("homoeo");
  });
});

describe("CLINIC_TYPES", () => {
  it("lists homoeo first with its labels", () => {
    expect(CLINIC_TYPES).toEqual([
      { value: "homoeo", label: "Homoeopathy" },
      { value: "general", label: "General practice" },
    ]);
  });
});

describe("clinicTypeLabel", () => {
  it("names each type", () => {
    expect(clinicTypeLabel("general")).toBe("General practice");
  });
});

describe("clinicFeatures", () => {
  it("turns on the homoeo case taking for homoeo clinics", () => {
    expect(clinicFeatures("homoeo")).toEqual({
      type: "homoeo",
      lsmc: true,
      differentialRemedy: true,
      homoeoGenerals: true,
      generalsTitle: "Generals",
    });
  });

  it("turns it off for general clinics", () => {
    expect(clinicFeatures("general")).toEqual({
      type: "general",
      lsmc: false,
      differentialRemedy: false,
      homoeoGenerals: false,
      generalsTitle: "Case history",
    });
  });
});
