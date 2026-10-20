import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const getDoc = vi.fn();
const batchSet = vi.fn();
const batchCommit = vi.fn();
const collection = vi.fn((...a: unknown[]) => ({ path: a[1] }));
const doc = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  writeBatch: () => ({ set: batchSet, commit: batchCommit }),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createClinic, listClinics } from "./clinicsRepo";

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
  batchSet.mockReset();
  batchCommit.mockReset();
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
    });
    expect(list[1].ownerEmail).toBeUndefined();
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
});
