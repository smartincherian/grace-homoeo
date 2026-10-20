import { describe, expect, it, vi, beforeEach } from "vitest";

const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchDelete = vi.fn();
const commit = vi.fn();
const getDocs = vi.fn();
const getDoc = vi.fn();
const setDoc = vi.fn();
const deleteDoc = vi.fn();
const addDoc = vi.fn();
const updateDoc = vi.fn();
const where = vi.fn((...a: unknown[]) => ({ where: a }));

vi.mock("firebase/firestore", () => ({
  writeBatch: () => ({
    set: (...a: unknown[]) => batchSet(...a),
    update: (...a: unknown[]) => batchUpdate(...a),
    delete: (...a: unknown[]) => batchDelete(...a),
    commit: () => commit(),
  }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  addDoc: (...a: unknown[]) => addDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  query: (...a: unknown[]) => ({ query: a }),
  where: (...a: unknown[]) => where(...a),
  doc: (ref: { path: string }) => ({ path: `${ref.path}/gen1`, id: "gen1" }),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
vi.mock("../../lib/clinic", () => ({
  getActiveClinic: () => "c1",
  clinicCollection: (name: string) => ({ path: `clinics/c1/${name}` }),
  clinicDoc: (name: string, id: string) => ({
    path: `clinics/c1/${name}/${id}`,
    id,
  }),
}));

import {
  createStaff,
  deleteLeave,
  deletePayment,
  LeaveOverlapError,
  listLeavesForMonth,
  markPaid,
  saveLeave,
} from "./staffRepo";
import type { Leave, StaffFormValues } from "./staffSchema";

const TZ = "Asia/Kolkata";
// Kolkata day start for a calendar date.
const day = (y: number, m: number, d: number) =>
  Date.UTC(y, m - 1, d) - 19800000;

function leaveDoc(l: Partial<Leave> & { id: string }) {
  return {
    id: l.id,
    data: () => ({
      staffId: "s1",
      staffName: "Asha",
      halfDay: false,
      type: "Casual",
      note: "",
      createdAt: 1,
      ...l,
    }),
  };
}

function paidDocs(...ids: string[]) {
  getDoc.mockImplementation(async (ref: { path: string }) => ({
    exists: () => ids.some((i) => ref.path.endsWith(`/${i}`)),
  }));
}

const values = (from: number, to: number) => ({
  staffId: "s1",
  staffName: "Asha",
  from,
  to,
  halfDay: false,
  type: "Unpaid" as const,
  note: "",
});

beforeEach(() => {
  for (const m of [
    batchSet,
    batchUpdate,
    batchDelete,
    commit,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    addDoc,
    updateDoc,
    where,
  ]) {
    m.mockReset();
  }
  commit.mockResolvedValue(undefined);
  where.mockImplementation((...a: unknown[]) => ({ where: a }));
  getDocs.mockResolvedValue({ docs: [] });
  paidDocs();
});

describe("listLeavesForMonth", () => {
  it("queries from <= month end and drops leaves ending before month start", async () => {
    getDocs.mockResolvedValue({
      docs: [
        leaveDoc({ id: "old", from: day(2026, 1, 5), to: day(2026, 1, 10) }),
        leaveDoc({ id: "in", from: day(2026, 1, 30), to: day(2026, 2, 2) }),
      ],
    });
    const res = await listLeavesForMonth("2026-02", TZ);
    expect(where).toHaveBeenCalledWith(
      "from",
      "<=",
      Date.UTC(2026, 1, 28, 18, 30) - 1,
    );
    expect(res.map((l) => l.id)).toEqual(["in"]);
    expect(Date.UTC(2026, 0, 31, 18, 30)).toBe(day(2026, 2, 1));
  });
});

describe("saveLeave", () => {
  it("creates a leave and flags only the paid month, in one batch", async () => {
    paidDocs("s1_2026-01");
    const id = await saveLeave(values(day(2026, 1, 30), day(2026, 2, 2)), TZ);
    expect(id).toBe("gen1");
    const paths = getDoc.mock.calls.map((c) => (c[0] as { path: string }).path);
    expect(paths).toEqual([
      "clinics/c1/salaryPayments/s1_2026-01",
      "clinics/c1/salaryPayments/s1_2026-02",
    ]);
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchSet.mock.calls[0][1]).toMatchObject({
      staffId: "s1",
      from: day(2026, 1, 30),
    });
    expect(typeof batchSet.mock.calls[0][1].createdAt).toBe("number");
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith(
      { path: "clinics/c1/salaryPayments/s1_2026-01", id: "s1_2026-01" },
      { needsReview: true },
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("flags both old and new months when an edit moves a leave", async () => {
    paidDocs("s1_2026-01", "s1_2026-03");
    const previous: Leave = {
      ...values(day(2026, 1, 10), day(2026, 1, 10)),
      id: "L1",
      createdAt: 5,
    };
    getDocs.mockResolvedValue({ docs: [leaveDoc(previous)] });
    await saveLeave(values(day(2026, 3, 10), day(2026, 3, 10)), TZ, previous);
    const flagged = batchUpdate.mock.calls.map(
      (c) => (c[0] as { id: string }).id,
    );
    expect(flagged.sort()).toEqual(["s1_2026-01", "s1_2026-03"]);
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect((batchSet.mock.calls[0][0] as { id: string }).id).toBe("L1");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("throws LeaveOverlapError and writes nothing on overlap", async () => {
    getDocs.mockResolvedValue({
      docs: [leaveDoc({ id: "x", from: day(2026, 2, 3), to: day(2026, 2, 5) })],
    });
    await expect(
      saveLeave(values(day(2026, 2, 5), day(2026, 2, 6)), TZ),
    ).rejects.toBeInstanceOf(LeaveOverlapError);
    expect(commit).not.toHaveBeenCalled();
  });

  it("does not treat the previous leave as an overlap", async () => {
    const previous: Leave = {
      ...values(day(2026, 2, 3), day(2026, 2, 5)),
      id: "L1",
      createdAt: 5,
    };
    getDocs.mockResolvedValue({ docs: [leaveDoc(previous)] });
    await expect(
      saveLeave(values(day(2026, 2, 3), day(2026, 2, 6)), TZ, previous),
    ).resolves.toBe("L1");
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe("deleteLeave", () => {
  it("deletes the leave and flags its paid month in one batch", async () => {
    paidDocs("s1_2026-02");
    const leave: Leave = {
      ...values(day(2026, 2, 3), day(2026, 2, 4)),
      id: "L1",
      createdAt: 5,
    };
    await deleteLeave(leave, TZ);
    expect(batchDelete).toHaveBeenCalledWith({
      path: "clinics/c1/leaves/L1",
      id: "L1",
    });
    expect(batchUpdate).toHaveBeenCalledWith(
      { path: "clinics/c1/salaryPayments/s1_2026-02", id: "s1_2026-02" },
      { needsReview: true },
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe("payments", () => {
  it("markPaid writes the doc with needsReview false", async () => {
    await markPaid({
      staffId: "s1",
      staffName: "Asha",
      month: "2026-02",
      base: 100,
      paidDays: 28,
      unpaidDays: 0,
      deduction: 0,
      adjustment: 0,
      adjustmentNote: "",
      net: 100,
      paidOn: 1,
      paymentMode: "Cash",
    });
    const [ref, data] = setDoc.mock.calls[0];
    expect(ref.id).toBe("s1_2026-02");
    expect(data).toMatchObject({ net: 100, needsReview: false });
  });

  it("deletePayment deletes the payment id", async () => {
    await deletePayment("s1", "2026-02");
    expect(deleteDoc.mock.calls[0][0].id).toBe("s1_2026-02");
  });
});

describe("createStaff", () => {
  const base: StaffFormValues = {
    name: "Asha K",
    phone: "",
    designation: "",
    joinedOn: 1,
    leftOn: null,
    monthlySalary: 1000,
  };
  it("writes nameLower and active", async () => {
    addDoc.mockResolvedValue({ id: "n1" });
    await createStaff(base);
    expect(addDoc.mock.calls[0][1]).toMatchObject({
      nameLower: "asha k",
      active: true,
    });
    await createStaff({ ...base, leftOn: 5 });
    expect(addDoc.mock.calls[1][1]).toMatchObject({ active: false });
  });
});
