import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const doc = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { hasAccess, isSuperadmin, normalizeEmail } from "./access";

const user = (email: string | null) => ({ uid: "u1", email }) as never;

beforeEach(() => {
  getDoc.mockReset();
  doc.mockClear();
});

describe("normalizeEmail / isSuperadmin", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Gmail.COM ")).toBe("foo@gmail.com");
  });
  it("recognises the superadmin case-insensitively", () => {
    expect(isSuperadmin("SMartin.Cherian@gmail.com")).toBe(true);
    expect(isSuperadmin("someone@gmail.com")).toBe(false);
    expect(isSuperadmin(null)).toBe(false);
  });
});

describe("hasAccess", () => {
  it("lets the superadmin in without a lookup", async () => {
    expect(await hasAccess(user("smartin.cherian@gmail.com"))).toBe(true);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("checks the allow list by lowercased email", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    expect(await hasAccess(user("Dr@Clinic.com"))).toBe(true);
    expect(doc).toHaveBeenCalledWith({}, "allowedEmails", "dr@clinic.com");
  });

  it("denies emails not on the list", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await hasAccess(user("stranger@gmail.com"))).toBe(false);
  });

  it("denies when the lookup is rejected or there is no email", async () => {
    getDoc.mockRejectedValue(new Error("permission-denied"));
    expect(await hasAccess(user("x@y.com"))).toBe(false);
    expect(await hasAccess(user(null))).toBe(false);
  });
});
