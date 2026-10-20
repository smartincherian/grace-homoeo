import { describe, expect, it } from "vitest";
import { bookingFormSchema } from "./bookingSchema";

const base = {
  patientId: null,
  patientName: "Asha",
  phone: "",
  serialNo: null,
  note: "",
};

describe("bookingFormSchema", () => {
  it("requires phone when no patient is picked", () => {
    expect(bookingFormSchema.safeParse(base).success).toBe(false);
  });
  it("allows empty phone with an existing patient", () => {
    expect(
      bookingFormSchema.safeParse({ ...base, patientId: "p1", serialNo: 4 })
        .success,
    ).toBe(true);
  });
  it("rejects a note over 200 characters", () => {
    expect(
      bookingFormSchema.safeParse({
        ...base,
        patientId: "p1",
        note: "x".repeat(201),
      }).success,
    ).toBe(false);
  });
});
