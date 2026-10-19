import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const getDoc = vi.fn();
const setDoc = vi.fn();
const collection = vi.fn((...a: unknown[]) => ({ path: a[1] }));
const doc = vi.fn((...a: unknown[]) => ({ path: `${a[1]}/${a[2]}` }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createClinic, listClinics } from "./clinicsRepo";

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
  setDoc.mockReset();
});

describe("clinicsRepo", () => {
  it("lists clinics sorted by name", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "b", data: () => ({ name: "Zeta", createdAt: 2 }) },
        { id: "a", data: () => ({ name: "Alpha", createdAt: 1 }) },
      ],
    });
    const list = await listClinics();
    expect(list.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    expect(list[0]).toEqual({ id: "a", name: "Alpha", createdAt: 1 });
  });

  it("creates clinics/{id} with name and createdAt", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await createClinic("c1", "Clinic One");
    expect(doc).toHaveBeenCalledWith({}, "clinics", "c1");
    expect(setDoc).toHaveBeenCalledTimes(1);
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.name).toBe("Clinic One");
    expect(typeof payload.createdAt).toBe("number");
  });

  it("rejects when the clinic already exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await expect(createClinic("c1", "Clinic One")).rejects.toThrow("Clinic already exists");
    expect(setDoc).not.toHaveBeenCalled();
  });
});
