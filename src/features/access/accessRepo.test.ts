import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const setDoc = vi.fn();
const deleteDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "allowedEmails" }));
const doc = vi.fn((...a: unknown[]) => ({ id: a[2] }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import {
  addAllowedEmail,
  listAllowedEmails,
  removeAllowedEmail,
} from "./accessRepo";

beforeEach(() => {
  getDocs.mockReset();
  setDoc.mockReset();
  deleteDoc.mockReset();
});

describe("accessRepo", () => {
  it("adds an email keyed by its lowercased form", async () => {
    await addAllowedEmail(" Dr@Clinic.com ", "c1", "smartin.cherian@gmail.com");
    expect(doc).toHaveBeenCalledWith({}, "allowedEmails", "dr@clinic.com");
    const payload = setDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.email).toBe("dr@clinic.com");
    expect(payload.clinicId).toBe("c1");
    expect(payload.addedBy).toBe("smartin.cherian@gmail.com");
    expect(typeof payload.addedAt).toBe("number");
  });

  it("lists emails alphabetically", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "zed@x.com", data: () => ({ addedAt: 1, addedBy: "s" }) },
        { id: "amy@x.com", data: () => ({ addedAt: 2, addedBy: "s" }) },
      ],
    });
    const list = await listAllowedEmails();
    expect(list.map((e) => e.email)).toEqual(["amy@x.com", "zed@x.com"]);
  });

  it("maps a missing clinicId to an empty string", async () => {
    getDocs.mockResolvedValue({
      docs: [{ id: "a@x.com", data: () => ({ addedAt: 1, addedBy: "s" }) }],
    });
    const list = await listAllowedEmails();
    expect(list[0].clinicId).toBe("");
  });

  it("removes by lowercased email", async () => {
    await removeAllowedEmail("Amy@X.com");
    expect(doc).toHaveBeenCalledWith({}, "allowedEmails", "amy@x.com");
    expect(deleteDoc).toHaveBeenCalled();
  });
});
