import { describe, expect, it, vi, beforeEach } from "vitest";

const batchSet = vi.fn();
const batchDelete = vi.fn();
const batchUpdate = vi.fn();
const commit = vi.fn();
const runTransaction = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  writeBatch: () => ({
    set: (...a: unknown[]) => batchSet(...a),
    delete: (...a: unknown[]) => batchDelete(...a),
    update: (...a: unknown[]) => batchUpdate(...a),
    commit: () => commit(),
  }),
  runTransaction: (...a: unknown[]) => runTransaction(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  query: (...a: unknown[]) => ({ query: a }),
  where: (...a: unknown[]) => ({ where: a }),
  orderBy: (...a: unknown[]) => ({ orderBy: a }),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
vi.mock("../../lib/clinic", () => ({
  getActiveClinic: () => "c1",
  clinicCollection: (n: string, c = "c1") => ({ path: `clinics/${c}/${n}` }),
  clinicDoc: (n: string, id: string, c = "c1") => ({
    path: `clinics/${c}/${n}/${id}`,
    id,
  }),
}));

import {
  bookAppointment,
  closeAppointment,
  listDayHistory,
  listPatientChoices,
  markArrived,
  SlotTakenError,
} from "./bookingsRepo";

const TZ = "Asia/Kolkata";
const start = Date.UTC(2026, 10, 2, 4, 0); // 09:30 IST
const values = {
  patientId: null,
  patientName: "Asha",
  phone: "99",
  serialNo: null,
  note: "",
};

function tx(exists: boolean) {
  const set = vi.fn();
  runTransaction.mockImplementation(
    async (_d: unknown, fn: (t: unknown) => unknown) =>
      fn({ get: async () => ({ exists: () => exists }), set }),
  );
  return set;
}

describe("bookingsRepo", () => {
  beforeEach(() => {
    [
      batchSet,
      batchDelete,
      batchUpdate,
      commit,
      runTransaction,
      getDocs,
      updateDoc,
    ].forEach((m) => m.mockReset());
  });

  it("rejects with SlotTakenError when the slot exists", async () => {
    const set = tx(true);
    await expect(
      bookAppointment({ start, end: start + 900_000 }, values, "a@x.com", TZ),
    ).rejects.toBeInstanceOf(SlotTakenError);
    expect(set).not.toHaveBeenCalled();
  });

  it("creates the appointment when the slot is free", async () => {
    const set = tx(false);
    await bookAppointment(
      { start, end: start + 900_000 },
      values,
      "a@x.com",
      TZ,
    );
    const [ref, data] = set.mock.calls[0];
    expect(ref.path).toBe(`clinics/c1/appointments/${start}`);
    expect(data).toEqual(
      expect.objectContaining({
        date: Date.UTC(2026, 10, 1, 18, 30),
        status: "booked",
        createdBy: "a@x.com",
        consultationId: null,
        patientId: null,
        serialNo: null,
        start,
      }),
    );
    expect(Object.keys(data)).toHaveLength(12);
  });

  const appt = {
    id: String(start),
    date: 1,
    start,
    end: start + 900_000,
    patientId: null,
    patientName: "Asha",
    phone: "99",
    serialNo: null,
    status: "booked" as const,
    note: "",
    createdBy: "a@x.com",
    createdAt: 777,
    consultationId: null,
  };

  it("closeAppointment writes history and deletes in one batch", async () => {
    await closeAppointment(appt, "no-show", "b@x.com");
    const [ref, data] = batchSet.mock.calls[0];
    expect(ref.path).toBe(`clinics/c1/appointmentHistory/${start}_777`);
    expect(data).toEqual(
      expect.objectContaining({
        status: "no-show",
        closedBy: "b@x.com",
        closedAt: expect.any(Number),
      }),
    );
    expect("id" in data).toBe(false);
    expect(Object.keys(data)).toHaveLength(14);
    expect(batchDelete.mock.calls[0][0].path).toBe(
      `clinics/c1/appointments/${start}`,
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("markArrived updates status", async () => {
    await markArrived("123");
    expect(updateDoc.mock.calls[0][0].path).toBe("clinics/c1/appointments/123");
    expect(updateDoc.mock.calls[0][1]).toEqual({ status: "arrived" });
  });

  it("listDayHistory sorts by start for the given clinic", async () => {
    const h = (id: string, s: number) => ({
      id,
      data: () => ({
        ...appt,
        start: s,
        status: "cancelled",
        closedAt: 1,
        closedBy: "x",
      }),
    });
    getDocs.mockResolvedValue({ docs: [h("b", 2), h("a", 1)] });
    const r = await listDayHistory("c7", 5);
    expect(r.map((x) => x.start)).toEqual([1, 2]);
    expect(getDocs.mock.calls[0][0].query[0].path).toBe(
      "clinics/c7/appointmentHistory",
    );
  });

  it("listPatientChoices maps patients", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "p1",
          data: () => ({ name: "A", serialNo: 3, phone: "9", extra: 1 }),
        },
      ],
    });
    await expect(listPatientChoices()).resolves.toEqual([
      { id: "p1", name: "A", serialNo: 3, phone: "9" },
    ]);
  });
});
