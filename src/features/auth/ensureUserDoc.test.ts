import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const setDoc = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const doc = vi.fn((..._args: unknown[]) => ({ id: "u1" }));
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { ensureUserDoc } from "./ensureUserDoc";

describe("ensureUserDoc", () => {
  beforeEach(() => {
    getDoc.mockReset();
    setDoc.mockReset();
  });

  it("creates a users doc with role admin when none exists", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await ensureUserDoc({
      uid: "u1",
      email: "doc@x.com",
      displayName: "Dr",
    } as never);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), {
      uid: "u1",
      email: "doc@x.com",
      displayName: "Dr",
      role: "admin",
    });
  });

  it("gives the superadmin email the superadmin role", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await ensureUserDoc({
      uid: "u2",
      email: "smartin.cherian@gmail.com",
      displayName: "S",
    } as never);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ role: "superadmin" }),
    );
  });

  it("does nothing when the doc already exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await ensureUserDoc({
      uid: "u1",
      email: "doc@x.com",
      displayName: "Dr",
    } as never);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
