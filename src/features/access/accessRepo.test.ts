import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const deleteDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "allowedEmails" }));
const doc = vi.fn((...a: unknown[]) => ({ id: a[2] }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { listAllowedEmails, removeUnassignedEntry } from "./accessRepo";

beforeEach(() => {
  getDocs.mockReset();
  deleteDoc.mockReset();
});

describe("accessRepo", () => {
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

  it("maps seat, defaulting to an empty string", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "a@x.com", data: () => ({ seat: "2" }) },
        { id: "b@x.com", data: () => ({}) },
      ],
    });
    const list = await listAllowedEmails();
    expect(list.map((e) => e.seat)).toEqual(["2", ""]);
  });

  it("removes an unassigned entry by lowercased email", async () => {
    await removeUnassignedEntry(" Amy@X.com ");
    expect(doc).toHaveBeenCalledWith({}, "allowedEmails", "amy@x.com");
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});
