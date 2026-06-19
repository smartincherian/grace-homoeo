import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "patients" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "doc-ref" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
const nextPatientSerial = vi.fn();
vi.mock("../../lib/serial", () => ({
  nextPatientSerial: () => nextPatientSerial(),
}));

import { createPatient, listPatients, updatePatient } from "./patientsRepo";

beforeEach(() => {
  addDoc.mockReset();
  getDocs.mockReset();
  updateDoc.mockReset();
  nextPatientSerial.mockReset();
});

describe("createPatient", () => {
  it("assigns a serial and writes derived fields", async () => {
    nextPatientSerial.mockResolvedValue(7);
    addDoc.mockResolvedValue({ id: "new-id" });
    const id = await createPatient({
      name: "Asha",
      dob: 100,
      gender: "Female",
      place: "Kochi",
      phone: "9",
    });
    expect(id).toBe("new-id");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.serialNo).toBe(7);
    expect(payload.nameLower).toBe("asha");
    expect(payload.lastVisitAt).toBeNull();
    expect(typeof payload.createdAt).toBe("number");
  });
});

describe("listPatients", () => {
  it("maps Firestore docs to Patient objects", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "p1",
          data: () => ({
            name: "Asha",
            nameLower: "asha",
            dob: 1,
            gender: "Female",
            place: "Kochi",
            phone: "9",
            serialNo: 1,
            createdAt: 2,
            lastVisitAt: 3,
          }),
        },
      ],
    });
    const list = await listPatients();
    expect(list).toEqual([
      {
        id: "p1",
        name: "Asha",
        nameLower: "asha",
        dob: 1,
        gender: "Female",
        place: "Kochi",
        phone: "9",
        serialNo: 1,
        createdAt: 2,
        lastVisitAt: 3,
      },
    ]);
  });
});

describe("updatePatient", () => {
  it("rewrites nameLower from the new name", async () => {
    updateDoc.mockResolvedValue(undefined);
    await updatePatient("p1", {
      name: "New Name",
      dob: 1,
      gender: "Male",
      place: "",
      phone: "",
    });
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("new name");
  });
});
