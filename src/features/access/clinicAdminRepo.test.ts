import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const updateDoc = vi.fn();
const batchDelete = vi.fn();
const batchCommit = vi.fn();
const collection = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));
const doc = vi.fn((...a: unknown[]) => ({ path: a.slice(1).join("/") }));
const query = vi.fn((col: { path: string }, ...c: unknown[]) => ({
  ...col,
  c,
}));
const where = vi.fn((...a: unknown[]) => ({ where: a }));
const limit = vi.fn((n: number) => ({ limit: n }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  writeBatch: () => ({ delete: batchDelete, commit: batchCommit }),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...(a as [{ path: string }])),
  where: (...a: unknown[]) => where(...a),
  limit: (n: number) => limit(n),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import {
  CLINIC_COLLECTIONS,
  deleteClinic,
  setClinicActive,
  setClinicType,
  setUserActive,
} from "./clinicAdminRepo";

const snap = (paths: string[]) => ({
  empty: paths.length === 0,
  docs: paths.map((p) => ({ ref: { path: p } })),
});

beforeEach(() => {
  vi.clearAllMocks();
  batchCommit.mockResolvedValue(undefined);
});

describe("clinicAdminRepo", () => {
  it("sets a clinic active or inactive", async () => {
    await setClinicActive("c1", false);
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "clinics/c1" },
      { active: false },
    );
  });

  it("sets a clinic's type", async () => {
    await setClinicType("c1", "general");
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "clinics/c1" },
      { type: "general" },
    );
  });

  it("sets a user's allow-list entry active or inactive, by normalized email", async () => {
    await setUserActive(" A@X.com ", true);
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "allowedEmails/a@x.com" },
      { active: true },
    );
  });

  it("covers every clinic subcollection the rules allow", () => {
    expect([...CLINIC_COLLECTIONS].sort()).toEqual(
      [
        "appointmentHistory",
        "appointments",
        "consultations",
        "counters",
        "expenses",
        "generals",
        "inventory",
        "leaves",
        "lsmc",
        "orderItems",
        "patientSummaries",
        "patients",
        "salaryPayments",
        "seats",
        "settings",
        "staff",
      ].sort(),
    );
  });

  it("deletes users first, then every collection page by page, then the clinic doc", async () => {
    // Each query returns its pages in turn, then empty (as deletes take effect).
    const pages: Record<string, string[][]> = {
      allowedEmails: [["allowedEmails/o@x.com"]],
      "clinics/c1/patients": [
        ["clinics/c1/patients/p1", "clinics/c1/patients/p2"],
        ["clinics/c1/patients/p3"],
      ],
    };
    getDocs.mockImplementation(async (q: { path: string }) =>
      snap(pages[q.path]?.shift() ?? []),
    );
    const steps: string[] = [];
    await deleteClinic("c1", (s) => steps.push(s));

    const deleted = batchDelete.mock.calls.map((c) => c[0].path);
    expect(deleted[0]).toBe("allowedEmails/o@x.com");
    expect(deleted).toContain("clinics/c1/patients/p3");
    expect(deleted[deleted.length - 1]).toBe("clinics/c1");
    expect(where).toHaveBeenCalledWith("clinicId", "==", "c1");
    expect(limit).toHaveBeenCalledWith(400);
    expect(steps).toContain("patients");
  });

  it("stops on the first failed batch, so a retry can resume", async () => {
    getDocs.mockResolvedValue(snap(["allowedEmails/o@x.com"]));
    batchCommit.mockRejectedValueOnce(new Error("denied"));
    await expect(deleteClinic("c1")).rejects.toThrow("denied");
    expect(batchDelete).not.toHaveBeenCalledWith({ path: "clinics/c1" });
  });
});
