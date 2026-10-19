import { describe, expect, it } from "vitest";
import { consultationFormSchema } from "./consultationSchema";

const CLINICAL = {
  diagnosis: "Acute fever",
  testsRequired: "None",
  remedy: "Bryonia 30, 4 pills TDS x 5 days",
  followupCriteria: "Review if fever persists beyond 3 days",
};

describe("consultationFormSchema", () => {
  it("accepts a valid consultation", () => {
    const parsed = consultationFormSchema.parse({
      date: 100,
      complaint: "fever",
      amount: 200,
      paymentMode: "Cash",
      ...CLINICAL,
    });
    expect(parsed.amount).toBe(200);
    expect(parsed.remarks).toBe(""); // defaulted
    expect(parsed.differentialRemedy).toBe(""); // optional, defaulted
  });
  it("defaults every clinical field to empty when omitted", () => {
    const parsed = consultationFormSchema.parse({
      date: 1,
      amount: 0,
      paymentMode: "Cash",
    });
    expect(parsed.diagnosis).toBe("");
    expect(parsed.testsRequired).toBe("");
    expect(parsed.remedy).toBe("");
    expect(parsed.differentialRemedy).toBe("");
    expect(parsed.followupCriteria).toBe("");
  });
  it("no longer carries the legacy generals/allergy/history fields", () => {
    const parsed = consultationFormSchema.parse({
      date: 1,
      amount: 0,
      paymentMode: "Cash",
      generals: "x",
      allergy: "y",
      history: "z",
    });
    expect(parsed).not.toHaveProperty("generals");
    expect(parsed).not.toHaveProperty("allergy");
    expect(parsed).not.toHaveProperty("history");
  });
  it("rejects a negative amount", () => {
    expect(() =>
      consultationFormSchema.parse({
        date: 1,
        amount: -5,
        paymentMode: "Cash",
        ...CLINICAL,
      }),
    ).toThrow();
  });
  it("rejects an unknown payment mode", () => {
    expect(() =>
      consultationFormSchema.parse({
        date: 1,
        amount: 0,
        paymentMode: "Card",
        ...CLINICAL,
      }),
    ).toThrow();
  });
  it("requires a date", () => {
    expect(() =>
      consultationFormSchema.parse({
        amount: 0,
        paymentMode: "Cash",
        ...CLINICAL,
      }),
    ).toThrow();
  });
});
