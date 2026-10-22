import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "patients" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "new-pid", path: "gen" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));
const where = vi.fn((...a: unknown[]) => ({ where: a }));
const batchDelete = vi.fn();
const commit = vi.fn();
const getDoc = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
  where: (...a: unknown[]) => where(...a),
  writeBatch: () => ({
    delete: batchDelete,
    set: batchSet,
    update: batchUpdate,
    commit,
  }),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
const activeClinic = vi.hoisted(() => ({ id: "c1" }));
vi.mock("../../lib/clinic", () => ({
  getActiveClinic: () => activeClinic.id,
  clinicCollection: (n: string, c: string = activeClinic.id) => ({
    path: `clinics/${c}/${n}`,
  }),
  clinicDoc: (n: string, id: string, c: string = activeClinic.id) => ({
    path: `clinics/${c}/${n}/${id}`,
  }),
}));
const nextPatientSerial = vi.fn();
vi.mock("../../lib/serial", () => ({
  nextPatientSerial: (c?: string) => nextPatientSerial(c),
}));

import {
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "./patientsRepo";

beforeEach(() => {
  addDoc.mockReset();
  getDocs.mockReset();
  updateDoc.mockReset();
  batchDelete.mockReset();
  batchSet.mockReset();
  batchUpdate.mockReset();
  getDoc.mockReset();
  commit.mockReset();
  nextPatientSerial.mockReset();
  activeClinic.id = "c1";
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

  it("keeps the serial and the doc in the original clinic if the active clinic switches mid-save", async () => {
    nextPatientSerial.mockImplementation(async () => {
      activeClinic.id = "c2"; // the superadmin switches during the await
      return 7;
    });
    addDoc.mockResolvedValue({ id: "new-id" });
    await createPatient({
      name: "Asha",
      dob: 100,
      gender: "Female",
      place: "",
      phone: "",
    });
    expect(nextPatientSerial).toHaveBeenCalledWith("c1");
    expect(addDoc.mock.calls[0][0]).toEqual({ path: "clinics/c1/patients" });
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
    expect(query.mock.calls[0][0]).toEqual({ path: "clinics/c1/patients" });
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

describe("deletePatient", () => {
  it("keeps every ref in the original clinic if the active clinic switches mid-delete", async () => {
    getDocs.mockImplementation(async () => {
      activeClinic.id = "c2"; // the superadmin switches during the awaits
      return { docs: [{ ref: { path: "clinics/c1/consultations/x" } }] };
    });
    commit.mockResolvedValue(undefined);
    await deletePatient("p1");
    const queried = query.mock.calls.map(
      (c) => (c[0] as { path: string }).path,
    );
    expect(queried.every((p) => p.startsWith("clinics/c1/"))).toBe(true);
    expect(batchDelete).toHaveBeenCalledWith({
      path: "clinics/c1/patients/p1",
    });
  });

  it("deletePatient also deletes the patient's summary", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    commit.mockResolvedValue(undefined);
    await deletePatient("p1");
    expect(batchDelete).toHaveBeenCalledWith({
      path: "clinics/c1/patientSummaries/p1",
    });
  });

  it("deletes the patient's consultations, case record and the patient", async () => {
    getDocs
      .mockResolvedValueOnce({ docs: [{ ref: "c1" }, { ref: "c2" }] })
      .mockResolvedValueOnce({ docs: [{ ref: "g1" }] })
      .mockResolvedValueOnce({ docs: [{ ref: "l1" }] });
    commit.mockResolvedValue(undefined);
    await deletePatient("p1");
    expect(
      query.mock.calls.map((c) => (c[0] as { path: string }).path),
    ).toEqual(
      expect.arrayContaining([
        "clinics/c1/consultations",
        "clinics/c1/generals",
        "clinics/c1/lsmc",
      ]),
    );
    expect(where).toHaveBeenCalledWith("patientId", "==", "p1");
    expect(batchDelete.mock.calls.map((c) => c[0])).toEqual([
      "c1",
      "c2",
      "g1",
      "l1",
      { path: "clinics/c1/patientSummaries/p1" },
      { path: "clinics/c1/patients/p1" },
    ]);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe("createPatient with an appointment", () => {
  const base = {
    name: "Asha",
    dob: 100,
    gender: "Female" as const,
    place: "",
    phone: "98",
  };
  const apptSnap = (exists: boolean, status = "booked") => ({
    exists: () => exists,
    data: () => ({ status }),
  });

  it("sets the patient and links the appointment in one batch", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockResolvedValue(apptSnap(true));
    const id = await createPatient(base, "123");
    expect(id).toBe("new-pid");
    expect(addDoc).not.toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchSet.mock.calls[0][1]).toMatchObject({ serialNo: 7 });
    expect(batchUpdate).toHaveBeenCalledWith(
      { path: "clinics/c1/appointments/123" },
      { patientId: "new-pid", serialNo: 7, patientName: "Asha", phone: "98" },
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("still saves the patient when the appointment is gone", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockResolvedValue(apptSnap(false));
    await createPatient(base, "123");
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does not touch an appointment that is already done", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockResolvedValue(apptSnap(true, "done"));
    await createPatient(base, "123");
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it("clamps the name to 80 chars, phone to 20, and a non-integer serial to null", async () => {
    nextPatientSerial.mockResolvedValue(7.5);
    getDoc.mockResolvedValue(apptSnap(true));
    await createPatient(
      { ...base, name: "N".repeat(100), phone: "9".repeat(30) },
      "123",
    );
    const link = batchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(link.patientName).toBe("N".repeat(80));
    expect(link.phone).toBe("9".repeat(20));
    expect(link.serialNo).toBeNull();
  });

  it("saves without a link when the appointment read throws", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockRejectedValue(new Error("offline"));
    commit.mockResolvedValue(undefined);
    const id = await createPatient(base, "123");
    expect(id).toBe("new-pid");
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it("reads the appointment before taking a serial", async () => {
    getDoc.mockImplementation(async () => {
      expect(nextPatientSerial).not.toHaveBeenCalled();
      return apptSnap(true);
    });
    nextPatientSerial.mockResolvedValue(7);
    commit.mockResolvedValue(undefined);
    await createPatient(base, "123");
    expect(getDoc).toHaveBeenCalledTimes(1);
  });

  it("retries the batch without the link when the linked commit fails", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockResolvedValue(apptSnap(true));
    commit
      .mockRejectedValueOnce(new Error("not-found"))
      .mockResolvedValue(undefined);
    const id = await createPatient(base, "123");
    expect(id).toBe("new-pid");
    expect(commit).toHaveBeenCalledTimes(2);
    expect(nextPatientSerial).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchSet).toHaveBeenCalledTimes(2);
  });

  it("still throws when a commit without a link fails", async () => {
    nextPatientSerial.mockResolvedValue(7);
    getDoc.mockResolvedValue(apptSnap(false));
    commit.mockRejectedValue(new Error("denied"));
    await expect(createPatient(base, "123")).rejects.toThrow("denied");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does not read appointments without an id", async () => {
    nextPatientSerial.mockResolvedValue(7);
    addDoc.mockResolvedValue({ id: "x" });
    await createPatient(base);
    expect(getDoc).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});
