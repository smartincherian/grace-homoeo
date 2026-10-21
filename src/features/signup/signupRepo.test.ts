import { vi } from "vitest";
import { FirebaseError } from "firebase/app";

const h = vi.hoisted(() => ({
  set: vi.fn(),
  commit: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }),
  getDoc: (...a: unknown[]) => h.getDoc(...a),
  writeBatch: () => ({ set: h.set, commit: h.commit }),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createOwnClinic, isSlugTaken } from "./signupRepo";

beforeEach(() => vi.clearAllMocks());

describe("createOwnClinic", () => {
  it("writes clinic, seat and allow-list entry in one batch", async () => {
    await createOwnClinic("sun", "Sun", "A@B.com", "general", 1000);
    expect(h.set).toHaveBeenCalledTimes(3);
    expect(h.set).toHaveBeenCalledWith(
      { path: "clinics/sun" },
      {
        name: "Sun",
        type: "general",
        createdAt: 1000,
        ownerEmail: "a@b.com",
        timeZone: "Asia/Kolkata",
        trialEndsAt: 1000 + 1814400000,
        authorized: false,
        authorizedAt: null,
        selfSignup: true,
      },
    );
    expect(h.set).toHaveBeenCalledWith(
      { path: "clinics/sun/seats/1" },
      { email: "a@b.com" },
    );
    expect(h.set).toHaveBeenCalledWith(
      { path: "allowedEmails/a@b.com" },
      {
        email: "a@b.com",
        clinicId: "sun",
        seat: "1",
        addedAt: 1000,
        addedBy: "a@b.com",
      },
    );
    expect(h.commit).toHaveBeenCalledTimes(1);
  });
});

describe("isSlugTaken", () => {
  it("is false when the doc does not exist", async () => {
    h.getDoc.mockResolvedValue({ exists: () => false });
    expect(await isSlugTaken("sun")).toBe(false);
  });
  it("is true when the rules deny the read", async () => {
    h.getDoc.mockRejectedValue(new FirebaseError("permission-denied", "x"));
    expect(await isSlugTaken("sun")).toBe(true);
  });
  it("rethrows other errors", async () => {
    h.getDoc.mockRejectedValue(new FirebaseError("unavailable", "x"));
    await expect(isSlugTaken("sun")).rejects.toThrow();
  });
});
