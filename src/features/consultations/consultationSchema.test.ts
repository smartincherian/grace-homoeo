import { describe, expect, it } from "vitest";
import { consultationFormSchema } from "./consultationSchema";

describe("consultationFormSchema", () => {
  it("accepts a valid consultation", () => {
    const parsed = consultationFormSchema.parse({
      date: 100,
      complaint: "fever",
      amount: 200,
      paymentMode: "Cash",
    });
    expect(parsed.amount).toBe(200);
    expect(parsed.generals).toBe(""); // defaulted
  });
  it("rejects a negative amount", () => {
    expect(() =>
      consultationFormSchema.parse({
        date: 1,
        amount: -5,
        paymentMode: "Cash",
      }),
    ).toThrow();
  });
  it("rejects an unknown payment mode", () => {
    expect(() =>
      consultationFormSchema.parse({ date: 1, amount: 0, paymentMode: "Card" }),
    ).toThrow();
  });
  it("requires a date", () => {
    expect(() =>
      consultationFormSchema.parse({ amount: 0, paymentMode: "Cash" }),
    ).toThrow();
  });
});
