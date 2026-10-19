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

import {
  getConsultationGenerals,
  latestGenerals,
  latestGeneralsBefore,
  listLsmcByPatient,
  listPatientGenerals,
} from "./caseRecordRepo";
import type { GeneralsRecord } from "./caseRecordSchema";

const snap = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
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

describe("latestGenerals / latestGeneralsBefore", () => {
  const rec = (id: string, date: number) =>
    ({ id, date }) as unknown as GeneralsRecord;
  const list = [rec("new", 300), rec("mid", 200), rec("old", 100)];

  it("latestGenerals is the first of the sorted list, or null", () => {
    expect(latestGenerals(list)?.id).toBe("new");
    expect(latestGenerals([])).toBeNull();
  });

  it("latestGeneralsBefore skips records on or after the date", () => {
    expect(latestGeneralsBefore(list, 300)?.id).toBe("mid");
    expect(latestGeneralsBefore(list, 100)).toBeNull();
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
