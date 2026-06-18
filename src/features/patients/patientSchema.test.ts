import { describe, expect, it } from "vitest";
import { patientFormSchema } from "./patientSchema";

describe("patientFormSchema", () => {
  it("accepts a valid patient", () => {
    const parsed = patientFormSchema.parse({
      name: "  Asha  ", dob: 946684800000, gender: "Female", place: "Kochi", phone: "9999",
    });
    expect(parsed.name).toBe("Asha"); // trimmed
    expect(parsed.gender).toBe("Female");
  });
  it("rejects an empty name", () => {
    expect(() => patientFormSchema.parse({ name: "   ", dob: 1, gender: "Male" })).toThrow();
  });
  it("rejects a missing dob", () => {
    expect(() => patientFormSchema.parse({ name: "A", gender: "Male" })).toThrow();
  });
  it("rejects an unknown gender", () => {
    expect(() => patientFormSchema.parse({ name: "A", dob: 1, gender: "X" })).toThrow();
  });
  it("defaults place and phone to empty strings", () => {
    const parsed = patientFormSchema.parse({ name: "A", dob: 1, gender: "Male" });
    expect(parsed.place).toBe("");
    expect(parsed.phone).toBe("");
  });
});
