import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const updateDoc = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();
const writeBatch = vi.fn((..._a: unknown[]) => ({
  set: batchSet,
  update: batchUpdate,
  delete: batchDelete,
  commit: batchCommit,
}));
const collection = vi.fn((...a: unknown[]) => ({ path: a[1] as string }));
// doc(colRef) -> auto id; doc(db, "col", id) -> that path.
const doc = vi.fn((...a: unknown[]) =>
  a.length === 1
    ? {
        id: "generated-id",
        path: `${(a[0] as { path: string }).path}/generated-id`,
      }
    : { id: a[a.length - 1], path: a.slice(1).join("/") },
);
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
  updateConsultation,
} from "./consultationsRepo";
import { EMPTY_GENERALS, type CaseRecordInput } from "./caseRecordSchema";

const values = {
  date: 500,
  complaint: "fever",
  diagnosis: "Acute fever",
  testsRequired: "None",
  remedy: "Bryonia",
  differentialRemedy: "",
  followupCriteria: "Review in 3 days",
  remarks: "",
  amount: 200,
  paymentMode: "Cash" as const,
};

const NO_RECORD: CaseRecordInput = { generals: null, lsmc: [] };
const row = (cells: Partial<Record<string, string>> & { id?: string }) => ({
  location: "",
  sensation: "",
  modality: "",
  concomitant: "",
  ...cells,
});

// [path, payload] for every batch call of a kind.
const calls = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map((c) => [(c[0] as { path: string }).path, c[1]]);
const pathsOf = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.map((c) => (c[0] as { path: string }).path);

beforeEach(() => {
  getDocs.mockReset();
  batchSet.mockReset();
  batchUpdate.mockReset();
  batchDelete.mockReset();
  batchCommit.mockReset();
  batchCommit.mockResolvedValue(undefined);
});

describe("createConsultation", () => {
  it("batches the consultation write with a patient lastVisit update", async () => {
    batchCommit.mockResolvedValue(undefined);
    const id = await createConsultation(
      { id: "p1", name: "Asha", serialNo: 7 },
      values,
      NO_RECORD,
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

const PATIENT = { id: "p1", name: "Asha", serialNo: 7 };

describe("createConsultation case record", () => {
  it("writes a generals snapshot linked to the new consultation", async () => {
    await createConsultation(PATIENT, values, {
      generals: { ...EMPTY_GENERALS, thirst: "thirstless" },
      lsmc: [],
    });
    const g = calls(batchSet).find(([p]) => p === "generals/generated-id");
    expect(g).toBeDefined();
    expect(g![1]).toMatchObject({
      consultationId: "generated-id",
      patientId: "p1",
      date: 500,
      thirst: "thirstless",
    });
  });

  it("writes no generals when record.generals is null", async () => {
    await createConsultation(PATIENT, values, NO_RECORD);
    expect(pathsOf(batchSet).some((p) => p.startsWith("generals/"))).toBe(
      false,
    );
  });

  it("skips all-blank generals and blank LSMC rows", async () => {
    await createConsultation(PATIENT, values, {
      generals: EMPTY_GENERALS,
      lsmc: [row({ location: "head" }), row({ sensation: "  " })],
    });
    expect(pathsOf(batchSet)).toEqual([
      "consultations/generated-id",
      "lsmc/generated-id",
    ]);
    const lsmc = batchSet.mock.calls[1][1] as Record<string, unknown>;
    expect(lsmc).toMatchObject({
      patientId: "p1",
      consultationId: "generated-id",
      date: 500,
      location: "head",
    });
    expect(lsmc).not.toHaveProperty("id");
  });
});

describe("LSMC entry order", () => {
  const createdAts = () =>
    calls(batchSet)
      .filter(([p]) => p.startsWith("lsmc/"))
      .map(([, d]) => (d as { createdAt: number }).createdAt);

  it("stamps rows created together in the order they were entered", async () => {
    await createConsultation(PATIENT, values, {
      generals: null,
      lsmc: [
        row({ location: "a" }),
        row({ location: "b" }),
        row({ location: "c" }),
      ],
    });
    const t = createdAts();
    expect(t).toHaveLength(3);
    expect(t[0]).toBeLessThan(t[1]);
    expect(t[1]).toBeLessThan(t[2]);
  });

  it("stamps new rows added on edit in order", async () => {
    await updateConsultation(
      "c1",
      "p1",
      values,
      {
        generals: null,
        lsmc: [row({ location: "a" }), row({ location: "b" })],
      },
      [],
    );
    const t = createdAts();
    expect(t[0]).toBeLessThan(t[1]);
  });
});

describe("updateConsultation", () => {
  it("keeps legacy text fields untouched", async () => {
    await updateConsultation("c1", "p1", values, NO_RECORD, []);
    const [path, payload] = calls(batchUpdate)[0];
    expect(path).toBe("consultations/c1");
    expect(payload).not.toHaveProperty("generals");
    expect(payload).not.toHaveProperty("allergy");
    expect(payload).not.toHaveProperty("history");
    expect(batchCommit).toHaveBeenCalledOnce();
  });

  it("syncs LSMC rows: edits kept, adds new, deletes removed", async () => {
    await updateConsultation(
      "c1",
      "p1",
      values,
      {
        generals: null,
        lsmc: [row({ id: "l1", location: "knee" }), row({ location: "new" })],
      },
      ["l1", "l2"],
    );
    expect(calls(batchUpdate)).toContainEqual([
      "lsmc/l1",
      expect.objectContaining({ location: "knee", date: 500 }),
    ]);
    expect(calls(batchSet)).toContainEqual([
      "lsmc/generated-id",
      expect.objectContaining({
        location: "new",
        patientId: "p1",
        consultationId: "c1",
      }),
    ]);
    expect(pathsOf(batchDelete)).toEqual(["lsmc/l2"]);
  });

  it("deletes an LSMC row that was blanked out", async () => {
    await updateConsultation(
      "c1",
      "p1",
      values,
      { generals: null, lsmc: [row({ id: "l1" })] },
      ["l1"],
    );
    expect(pathsOf(batchDelete)).toEqual(["lsmc/l1"]);
    expect(pathsOf(batchUpdate)).not.toContain("lsmc/l1");
  });

  it("deletes the generals doc when all fields are blank", async () => {
    await updateConsultation(
      "c1",
      "p1",
      values,
      { generals: EMPTY_GENERALS, lsmc: [] },
      [],
    );
    expect(pathsOf(batchDelete)).toContain("generals/c1");
  });

  it("leaves generals alone when record.generals is null", async () => {
    await updateConsultation("c1", "p1", values, NO_RECORD, []);
    const all = [
      ...pathsOf(batchSet),
      ...pathsOf(batchUpdate),
      ...pathsOf(batchDelete),
    ];
    expect(all.some((p) => p.startsWith("generals/"))).toBe(false);
  });

  it("writes the new date onto generals and LSMC rows", async () => {
    await updateConsultation(
      "c1",
      "p1",
      { ...values, date: 900 },
      {
        generals: { ...EMPTY_GENERALS, thirst: "low" },
        lsmc: [row({ id: "l1", location: "knee" })],
      },
      ["l1"],
    );
    expect(calls(batchSet)).toContainEqual([
      "generals/c1",
      expect.objectContaining({ date: 900, patientId: "p1", thirst: "low" }),
    ]);
    expect(calls(batchUpdate)).toContainEqual([
      "lsmc/l1",
      expect.objectContaining({ date: 900 }),
    ]);
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
