import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }),
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }),
}));
vi.mock("./firebase", () => ({ db: {} }));

import {
  DEFAULT_BRANDING,
  displayNameOf,
  getBranding,
  readCachedBranding,
  saveBranding,
  writeCachedBranding,
} from "./branding";

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", memoryStorage);

beforeEach(() => {
  getDoc.mockReset();
  setDoc.mockReset();
  setDoc.mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("getBranding", () => {
  it("returns defaults for a missing doc", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await getBranding("c1")).toEqual(DEFAULT_BRANDING);
  });

  it("merges a partial doc over defaults", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ primaryColor: "#0f766e" }),
    });
    expect(await getBranding("c1")).toEqual({
      ...DEFAULT_BRANDING,
      primaryColor: "#0f766e",
    });
  });
});

describe("saveBranding", () => {
  it("writes the doc with updatedAt and updatedBy", async () => {
    await saveBranding(
      "c1",
      { ...DEFAULT_BRANDING, displayName: "G" },
      "o@x.com",
    );
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref.path).toBe("clinics/c1/settings/branding");
    expect(data.displayName).toBe("G");
    expect(data.updatedBy).toBe("o@x.com");
    expect(typeof data.updatedAt).toBe("number");
  });
});

describe("cache", () => {
  it("round-trips", () => {
    const b = { ...DEFAULT_BRANDING, displayName: "X" };
    writeCachedBranding("c1", b);
    expect(localStorage.getItem("homoeodesk.branding.c1")).toBeTruthy();
    expect(readCachedBranding("c1")).toEqual(b);
    expect(readCachedBranding("c2")).toBeUndefined();
  });

  it("is safe when storage throws", () => {
    vi.spyOn(memoryStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(memoryStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readCachedBranding("c1")).toBeUndefined();
    expect(() => writeCachedBranding("c1", DEFAULT_BRANDING)).not.toThrow();
  });

  it("replaces wrongly-typed cached fields with defaults", () => {
    localStorage.setItem(
      "homoeodesk.branding.c1",
      JSON.stringify({
        displayName: 5,
        contact: "x",
        primaryColor: "blue",
        showScripture: "no",
      }),
    );
    expect(readCachedBranding("c1")).toEqual(DEFAULT_BRANDING);
  });

  it("ignores corrupt JSON", () => {
    localStorage.setItem("homoeodesk.branding.c1", "{nope");
    expect(readCachedBranding("c1")).toBeUndefined();
  });
});

describe("displayNameOf", () => {
  it("falls back in order", () => {
    expect(
      displayNameOf({ ...DEFAULT_BRANDING, displayName: " Mine " }, "Clinic"),
    ).toBe("Mine");
    expect(displayNameOf(DEFAULT_BRANDING, "Clinic")).toBe("Clinic");
    expect(displayNameOf(undefined, undefined)).toBe("Grace Medica");
  });
});

describe("displayNameOf robustness", () => {
  it("does not throw on a non-string displayName", () => {
    const bad = {
      ...DEFAULT_BRANDING,
      displayName: 5,
    } as unknown as typeof DEFAULT_BRANDING;
    expect(displayNameOf(bad, "Clinic")).toBe("Clinic");
  });
});
