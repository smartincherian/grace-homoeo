import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const updateDoc = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();
const writeBatch = vi.fn((..._a: unknown[]) => ({
  set: batchSet,
  update: batchUpdate,
  commit: batchCommit,
}));
const collection = vi.fn((..._a: unknown[]) => ({ path: "consultations" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "generated-id" }));
const query = vi.fn((...a: unknown[]) => a);
const where = vi.fn((...a: unknown[]) => ({ where: a }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  writeBatch: (...a: unknown[]) => writeBatch(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  where: (...a: unknown[]) => where(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import {
  createConsultation,
  listConsultationsByPatient,
} from "./consultationsRepo";

const values = {
  date: 500,
  complaint: "fever",
  generals: "",
  allergy: "",
  history: "",
  remedy: "Bryonia",
  remarks: "",
  amount: 200,
  paymentMode: "Cash" as const,
};

beforeEach(() => {
  getDocs.mockReset();
  batchSet.mockReset();
  batchUpdate.mockReset();
  batchCommit.mockReset();
});

describe("createConsultation", () => {
  it("batches the consultation write with a patient lastVisit update", async () => {
    batchCommit.mockResolvedValue(undefined);
    const id = await createConsultation(
      { id: "p1", name: "Asha", serialNo: 7 },
      values,
    );
    expect(id).toBe("generated-id");
    const payload = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.patientId).toBe("p1");
    expect(payload.patientName).toBe("Asha");
    expect(payload.serialNo).toBe(7);
    expect(payload.remedy).toBe("Bryonia");
    expect(typeof payload.createdAt).toBe("number");
    const visit = batchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(visit.lastVisitAt).toBe(500);
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("listConsultationsByPatient", () => {
  it("returns consultations sorted by date descending", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "c1",
          data: () => ({
            ...values,
            date: 100,
            patientId: "p1",
            patientName: "Asha",
            serialNo: 7,
            createdAt: 1,
          }),
        },
        {
          id: "c2",
          data: () => ({
            ...values,
            date: 900,
            patientId: "p1",
            patientName: "Asha",
            serialNo: 7,
            createdAt: 2,
          }),
        },
      ],
    });
    const list = await listConsultationsByPatient("p1");
    expect(list.map((c) => c.id)).toEqual(["c2", "c1"]);
  });
});
