import { describe, expect, it } from "vitest";
import { safeClinicId, safePatientId } from "./logIds";

describe("log id sanitizing", () => {
  it("passes valid ids and leaves missing ones undefined", () => {
    expect(safeClinicId("grace-homoeo")).toBe("grace-homoeo");
    expect(safePatientId("Ab_1-x")).toBe("Ab_1-x");
    expect(safeClinicId(undefined)).toBeUndefined();
    expect(safePatientId(undefined)).toBeUndefined();
  });
  it("replaces anything else with <invalid>", () => {
    for (const v of ["AIzaSyKEY", "a b", "x\nfake log", "", 5, {}, null, "a".repeat(41)]) {
      expect(safeClinicId(v)).toBe("<invalid>");
    }
    for (const v of ["has space", "a/b", "", 5, null, "a".repeat(129)]) {
      expect(safePatientId(v)).toBe("<invalid>");
    }
  });
});
