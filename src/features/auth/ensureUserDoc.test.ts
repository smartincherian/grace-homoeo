import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const setDoc = vi.fn();
const doc = vi.fn(() => ({ id: "u1" }));
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  doc: () => doc(),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { ensureUserDoc } from "./ensureUserDoc";

describe("ensureUserDoc", () => {
  beforeEach(() => { getDoc.mockReset(); setDoc.mockReset(); });

  it("creates a users doc with role admin when none exists", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await ensureUserDoc({ uid: "u1", email: "doc@x.com", displayName: "Dr" } as never);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), {
      uid: "u1", email: "doc@x.com", displayName: "Dr", role: "admin",
    });
  });

  it("does nothing when the doc already exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await ensureUserDoc({ uid: "u1", email: "doc@x.com", displayName: "Dr" } as never);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
