import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const doc = vi.fn((...a: unknown[]) => ({ path: `${a[1]}/${a[2]}` }));
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { getClinic } from "./clinicQueries";

beforeEach(() => getDoc.mockReset());

describe("getClinic", () => {
  it("returns the clinic when found", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      id: "c1",
      data: () => ({ name: "Clinic One", createdAt: 5 }),
    });
    expect(await getClinic("c1")).toEqual({ id: "c1", name: "Clinic One", createdAt: 5 });
    expect(doc).toHaveBeenCalledWith({}, "clinics", "c1");
  });

  it("returns null when not found", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await getClinic("nope")).toBeNull();
  });
});
