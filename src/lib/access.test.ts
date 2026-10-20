import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const doc = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import {
  canManageClinic,
  getMembership,
  homePath,
  isSuperadmin,
  normalizeEmail,
} from "./access";

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

describe("getMembership", () => {
  it("treats the superadmin as superadmin without a lookup", async () => {
    expect(await getMembership(user("smartin.cherian@gmail.com"))).toEqual({
      superadmin: true,
      clinicId: null,
      owner: false,
    });
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("returns the clinic from the allow-list entry", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ clinicId: "grace-homoeo" }),
    });
    expect(await getMembership(user("Dr@Clinic.com"))).toEqual({
      superadmin: false,
      clinicId: "grace-homoeo",
      owner: false,
    });
    expect(doc).toHaveBeenCalledWith({}, "allowedEmails", "dr@clinic.com");
  });

  const allowed = { exists: () => true, data: () => ({ clinicId: "c1" }) };
  const clinicDoc = (ownerEmail?: string) => ({ data: () => ({ ownerEmail }) });

  it("is owner when the clinic ownerEmail matches the normalized email", async () => {
    getDoc
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce(clinicDoc("dr@clinic.com"));
    expect(await getMembership(user(" Dr@Clinic.com "))).toEqual({
      superadmin: false,
      clinicId: "c1",
      owner: true,
    });
    expect(doc).toHaveBeenCalledWith({}, "clinics", "c1");
  });

  it("is not owner when ownerEmail differs or is missing", async () => {
    getDoc
      .mockResolvedValueOnce(allowed)
      .mockResolvedValueOnce(clinicDoc("other@clinic.com"));
    expect((await getMembership(user("dr@clinic.com")))?.owner).toBe(false);
    getDoc.mockResolvedValueOnce(allowed).mockResolvedValueOnce(clinicDoc());
    expect((await getMembership(user("dr@clinic.com")))?.owner).toBe(false);
  });

  it("returns a non-owner membership when the clinic doc read throws", async () => {
    getDoc
      .mockResolvedValueOnce(allowed)
      .mockRejectedValueOnce(new Error("denied"));
    expect(await getMembership(user("dr@clinic.com"))).toEqual({
      superadmin: false,
      clinicId: "c1",
      owner: false,
    });
  });

  it("returns null for an entry without clinicId", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    expect(await getMembership(user("a@b.com"))).toBeNull();
  });

  it("returns null for a missing entry", async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await getMembership(user("stranger@gmail.com"))).toBeNull();
  });

  it("returns null when the lookup rejects or there is no email", async () => {
    getDoc.mockRejectedValue(new Error("permission-denied"));
    expect(await getMembership(user("x@y.com"))).toBeNull();
    expect(await getMembership(user(null))).toBeNull();
  });
});

describe("homePath", () => {
  it("routes superadmin to /admin and members to their clinic", () => {
    expect(homePath({ superadmin: true, clinicId: null, owner: false })).toBe(
      "/admin",
    );
    expect(homePath({ superadmin: false, clinicId: "c1", owner: false })).toBe(
      "/c1/patients",
    );
  });
});

describe("canManageClinic", () => {
  const sa = { superadmin: true, clinicId: null, owner: false };
  const owner = { superadmin: false, clinicId: "c1", owner: true };
  const member = { superadmin: false, clinicId: "c1", owner: false };
  it("allows superadmin anywhere and owner only in own clinic", () => {
    expect(canManageClinic(sa, "any")).toBe(true);
    expect(canManageClinic(owner, "c1")).toBe(true);
    expect(canManageClinic(owner, "c2")).toBe(false);
    expect(canManageClinic(member, "c1")).toBe(false);
    expect(canManageClinic(undefined, "c1")).toBe(false);
  });
});
