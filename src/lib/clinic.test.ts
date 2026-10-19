import { describe, expect, it, vi, beforeEach } from "vitest";

const collection = vi.fn((...a: unknown[]) => a);
const doc = vi.fn((...a: unknown[]) => a);
vi.mock("firebase/firestore", () => ({
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import {
  clinicCollection,
  clinicDoc,
  getActiveClinic,
  peekActiveClinic,
  isValidSlug,
  setActiveClinic,
  slugify,
} from "./clinic";

describe("active clinic", () => {
  beforeEach(() => {
    setActiveClinic(null);
    collection.mockClear();
    doc.mockClear();
  });

  it("throws when no clinic is set, and after clearing", () => {
    expect(() => getActiveClinic()).toThrow("No active clinic");
    setActiveClinic("grace-homoeo");
    expect(getActiveClinic()).toBe("grace-homoeo");
    setActiveClinic(null);
    expect(() => getActiveClinic()).toThrow("No active clinic");
  });

  it("peeks at the active clinic without throwing", () => {
    expect(peekActiveClinic()).toBeNull();
    setActiveClinic("grace-homoeo");
    expect(peekActiveClinic()).toBe("grace-homoeo");
  });

  it("scopes collection and doc refs under the active clinic", () => {
    setActiveClinic("grace-homoeo");
    clinicCollection("patients");
    expect(collection).toHaveBeenCalledWith(
      {},
      "clinics",
      "grace-homoeo",
      "patients",
    );
    clinicDoc("counters", "patients");
    expect(doc).toHaveBeenCalledWith(
      {},
      "clinics",
      "grace-homoeo",
      "counters",
      "patients",
    );
  });
});

describe("explicit clinic", () => {
  it("builds refs under the given clinic, not the active one", () => {
    setActiveClinic("other");
    clinicCollection("patients", "pinned");
    expect(collection).toHaveBeenCalledWith(
      {},
      "clinics",
      "pinned",
      "patients",
    );
    clinicDoc("counters", "patients", "pinned");
    expect(doc).toHaveBeenCalledWith(
      {},
      "clinics",
      "pinned",
      "counters",
      "patients",
    );
  });

  it("does not need an active clinic when one is given", () => {
    setActiveClinic(null);
    expect(() => clinicCollection("patients", "pinned")).not.toThrow();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Grace Homoeo Clinic!")).toBe("grace-homoeo-clinic");
    expect(slugify("  St. Mary's  ")).toBe("st-mary-s");
  });
  it("cuts to 40 chars", () => {
    expect(slugify("a".repeat(60))).toHaveLength(40);
  });
});

describe("isValidSlug", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("grace-homoeo")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
  });
  it.each(["ab", "Grace", "-x-", "a--b", "patients", "admin", "a".repeat(41)])(
    "rejects %s",
    (s) => expect(isValidSlug(s)).toBe(false),
  );
});
