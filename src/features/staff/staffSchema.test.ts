import { describe, expect, test } from "vitest";
import { leaveFormSchema, paymentId, staffFormSchema } from "./staffSchema";

const DAY = 86_400_000;
const leave = { staffId: "s1", staffName: "A", from: 10 * DAY, to: 10 * DAY, halfDay: false, type: "Casual" as const };

describe("staffSchema", () => {
  test("leave accepts a valid single day", () => {
    expect(leaveFormSchema.safeParse(leave).success).toBe(true);
  });
  test("leave rejects to < from", () => {
    const r = leaveFormSchema.safeParse({ ...leave, to: 9 * DAY });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["to"]);
  });
  test("leave rejects half day over multiple days", () => {
    const r = leaveFormSchema.safeParse({ ...leave, to: 11 * DAY, halfDay: true });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["halfDay"]);
  });
  test("staff rejects leftOn < joinedOn", () => {
    const r = staffFormSchema.safeParse({ name: "A", joinedOn: 10 * DAY, leftOn: 9 * DAY, monthlySalary: 100 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["leftOn"]);
  });
  test("staff applies defaults", () => {
    const r = staffFormSchema.parse({ name: " A ", joinedOn: DAY, monthlySalary: 0 });
    expect(r).toMatchObject({ name: "A", phone: "", designation: "", leftOn: null });
  });
  test("paymentId", () => {
    expect(paymentId("s1", "2026-02")).toBe("s1_2026-02");
  });
});
