import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const getDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  collection: (...a: unknown[]) => ({ path: a[1] }),
  doc: (...a: unknown[]) => ({ path: a.slice(1).join("/") }),
  query: (...a: unknown[]) => a,
  where: (...a: unknown[]) => ({ where: a }),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
vi.mock("../../lib/clinic", () => ({
  clinicCollection: (n: string) => ({ path: `clinics/c1/${n}` }),
  clinicDoc: (n: string, id: string) => ({ path: `clinics/c1/${n}/${id}` }),
}));

import {
  fieldHistory,
  getConsultationGenerals,
  listLsmcByPatient,
  listPatientGenerals,
  priorRecords,
} from "./caseRecordRepo";
import { EMPTY_GENERALS, type GeneralsRecord } from "./caseRecordSchema";

const snap = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
});

describe("clinic scoping", () => {
  it("reads the patient's generals from the active clinic", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await listPatientGenerals("p1");
    expect((getDocs.mock.calls[0][0] as unknown[])[0]).toEqual({
      path: "clinics/c1/generals",
    });
  });
});

describe("listPatientGenerals", () => {
  it("sorts by date, then updatedAt, newest first", async () => {
    getDocs.mockResolvedValue({
      docs: [
        snap("a", {
          patientId: "p1",
          consultationId: "a",
          date: 100,
          updatedAt: 1,
        }),
        snap("b", {
          patientId: "p1",
          consultationId: "b",
          date: 300,
          updatedAt: 1,
        }),
        snap("c", {
          patientId: "p1",
          consultationId: "c",
          date: 300,
          updatedAt: 9,
        }),
      ],
    });
    const list = await listPatientGenerals("p1");
    expect(list.map((g) => g.id)).toEqual(["c", "b", "a"]);
  });

  it("fills missing fields with defaults", async () => {
    getDocs.mockResolvedValue({
      docs: [
        snap("a", {
          patientId: "p1",
          consultationId: "a",
          date: 1,
          thirst: "low",
        }),
      ],
    });
    const [g] = await listPatientGenerals("p1");
    expect(g.thirst).toBe("low");
    expect(g.appetite).toBe("");
    expect(g.lmp).toBeNull();
  });
});

describe("getConsultationGenerals", () => {
  it("is null when the visit has no generals", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await getConsultationGenerals("c1")).toBeNull();
  });
});

const rec = (
  cid: string,
  date: number,
  over: Partial<GeneralsRecord> = {},
): GeneralsRecord => ({
  ...EMPTY_GENERALS,
  id: cid,
  patientId: "p1",
  consultationId: cid,
  date,
  updatedAt: 0,
  ...over,
});

describe("fieldHistory", () => {
  // newest first, as listPatientGenerals returns them
  const list = [
    rec("v4", 400, { thirst: "high" }),
    rec("v3", 300),
    rec("v2", 200, { thirst: "low " }),
    rec("v1", 100, { thirst: "low", lmp: 50 }),
  ];

  it("lists non-blank values newest first, collapsing repeats to when first entered", () => {
    expect(fieldHistory(list, "thirst")).toEqual([
      { value: "high", date: 400, consultationId: "v4" },
      { value: "low", date: 100, consultationId: "v1" },
    ]);
  });

  it("keeps LMP as a number", () => {
    expect(fieldHistory(list, "lmp")).toEqual([
      { value: 50, date: 100, consultationId: "v1" },
    ]);
  });

  it("is empty for a field never recorded", () => {
    expect(fieldHistory(list, "appetite")).toEqual([]);
  });
});

describe("priorRecords", () => {
  const list = [rec("v3", 300), rec("v2", 200), rec("v1", 100)];

  it("returns everything for a new visit", () => {
    expect(priorRecords(list).map((r) => r.id)).toEqual(["v3", "v2", "v1"]);
  });

  it("returns other visits on or before the edited visit's date", () => {
    expect(
      priorRecords(list, { id: "v2", date: 200 }).map((r) => r.id),
    ).toEqual(["v1"]);
    expect(
      priorRecords([...list, rec("same", 200)], { id: "v2", date: 200 }).map(
        (r) => r.id,
      ),
    ).toEqual(["v1", "same"]);
  });
});

describe("listLsmcByPatient", () => {
  it("lists newest visit first, in entry order within a visit", async () => {
    getDocs.mockResolvedValue({
      docs: [
        snap("x2", {
          consultationId: "old",
          date: 100,
          createdAt: 2,
          location: "knee",
        }),
        snap("y2", { consultationId: "new", date: 900, createdAt: 6 }),
        snap("y1", { consultationId: "new", date: 900, createdAt: 5 }),
      ],
    });
    const rows = await listLsmcByPatient("p1");
    expect(rows.map((r) => r.id)).toEqual(["y1", "y2", "x2"]);
    expect(rows[2].location).toBe("knee");
    expect(rows[0].sensation).toBe("");
  });
});
