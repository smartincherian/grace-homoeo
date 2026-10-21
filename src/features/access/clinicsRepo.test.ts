import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const getDoc = vi.fn();
const batchSet = vi.fn();
const batchCommit = vi.fn();
const collection = vi.fn((...a: unknown[]) => ({ path: a[1] }));
const updateDoc = vi.fn();
const doc = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  writeBatch: () => ({ set: batchSet, commit: batchCommit }),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createClinic, listClinics, setClinicAuthorized } from "./clinicsRepo";

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
  batchSet.mockReset();
  batchCommit.mockReset();
  updateDoc.mockReset();
});

describe("clinicsRepo", () => {
  it("lists clinics sorted by name, mapping ownerEmail", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "b", data: () => ({ name: "Zeta", createdAt: 2 }) },
        {
          id: "a",
          data: () => ({ name: "Alpha", createdAt: 1, ownerEmail: "o@x.com" }),
        },
      ],
    });
    const list = await listClinics();
    expect(list.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    expect(list[0]).toEqual({
      id: "a",
      name: "Alpha",
      createdAt: 1,
      ownerEmail: "o@x.com",
      active: true,
    });
    expect(list[1].ownerEmail).toBeUndefined();
  });

  it("maps trial fields in the list, undefined when absent", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "a",
          data: () => ({
            name: "A",
            createdAt: 1,
            authorized: true,
            trialEndsAt: 9,
            selfSignup: true,
            authorizedAt: 3,
          }),
        },
        { id: "b", data: () => ({ name: "B", createdAt: 2 }) },
      ],
    });
    const [a, b] = await listClinics();
    expect(a).toMatchObject({
      authorized: true,
      trialEndsAt: 9,
      selfSignup: true,
      authorizedAt: 3,
    });
    expect(b.authorized).toBeUndefined();
    expect(b.trialEndsAt).toBeUndefined();
  });

  it("creates clinic, seat 1 and allow-list entry in one batch", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await createClinic(
      "c1",
      "Clinic One",
      " Owner@X.com ",
      "smartin.cherian@gmail.com",
    );
    expect(batchSet).toHaveBeenCalledTimes(3);
    const byPath = Object.fromEntries(
      batchSet.mock.calls.map((c) => [
        (c[0] as { path: string }).path,
        c[1] as Record<string, unknown>,
      ]),
    );
    expect(byPath["clinics/c1"]).toMatchObject({
      name: "Clinic One",
      ownerEmail: "owner@x.com",
      timeZone: "Asia/Kolkata",
    });
    expect(typeof byPath["clinics/c1"].createdAt).toBe("number");
    expect(byPath["clinics/c1/seats/1"]).toEqual({ email: "owner@x.com" });
    expect(byPath["allowedEmails/owner@x.com"]).toMatchObject({
      email: "owner@x.com",
      clinicId: "c1",
      seat: "1",
      addedBy: "smartin.cherian@gmail.com",
    });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects when the clinic already exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await expect(createClinic("c1", "C", "o@x.com", "s")).rejects.toThrow(
      "Clinic already exists",
    );
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("rejects an invalid or superadmin owner email without writing", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await expect(createClinic("c1", "C", "nope", "s")).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(
      createClinic("c1", "C", "Smartin.Cherian@gmail.com", "s"),
    ).rejects.toMatchObject({ code: "superadmin" });
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("stamps a trial and authorization on a new clinic", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    const written = async (authorized: boolean) => {
      batchSet.mockReset();
      await createClinic("c", "C", "o@x.com", "s", authorized, 1000);
      return batchSet.mock.calls.find(
        (c) => (c[0] as { path: string }).path === "clinics/c",
      )![1];
    };
    expect(await written(false)).toMatchObject({
      createdAt: 1000,
      trialEndsAt: 1000 + 1814400000,
      authorized: false,
      authorizedAt: null,
      selfSignup: false,
    });
    expect(await written(true)).toMatchObject({
      authorized: true,
      authorizedAt: 1000,
    });
  });

  it("setClinicAuthorized sets trialEndsAt only for a legacy clinic losing it", async () => {
    await setClinicAuthorized({ id: "c", name: "C", createdAt: 1 }, false, 5);
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: "clinics/c" },
      { authorized: false, authorizedAt: null, trialEndsAt: 5 },
    );
    await setClinicAuthorized(
      { id: "c", name: "C", createdAt: 1, trialEndsAt: 99 },
      false,
      5,
    );
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: "clinics/c" },
      { authorized: false, authorizedAt: null },
    );
    await setClinicAuthorized({ id: "c", name: "C", createdAt: 1 }, true, 5);
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: "clinics/c" },
      { authorized: true, authorizedAt: 5 },
    );
  });

  it("lists expired first, then trials by days left, then the rest", async () => {
    const day = 86_400_000;
    const now = 100 * day;
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "a",
          data: () => ({ name: "A", createdAt: 1, authorized: true }),
        },
        {
          id: "b",
          data: () => ({
            name: "B",
            createdAt: 1,
            trialEndsAt: now + 10 * day,
          }),
        },
        {
          id: "c",
          data: () => ({ name: "C", createdAt: 1, trialEndsAt: now - day }),
        },
        {
          id: "d",
          data: () => ({ name: "D", createdAt: 1, trialEndsAt: now + 2 * day }),
        },
      ],
    });
    expect((await listClinics(now)).map((c) => c.id)).toEqual([
      "c",
      "d",
      "b",
      "a",
    ]);
  });
});
