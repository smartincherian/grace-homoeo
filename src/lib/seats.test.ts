import { describe, expect, it, vi, beforeEach } from "vitest";
import { FirebaseError } from "firebase/app";

const batchSet = vi.fn();
const batchDelete = vi.fn();
const commit = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  writeBatch: () => ({
    set: (...a: unknown[]) => batchSet(...a),
    delete: (...a: unknown[]) => batchDelete(...a),
    commit: () => commit(),
  }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  collection: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { addUser, listSeats, removeUser, setOwner, SeatError } from "./seats";
import { SUPERADMIN_EMAIL } from "./access";

beforeEach(() => {
  batchSet.mockReset();
  batchDelete.mockReset();
  commit.mockReset();
  commit.mockResolvedValue(undefined);
  getDocs.mockReset();
  updateDoc.mockReset();
});

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(SeatError);
    return (e as SeatError).code;
  }
  throw new Error("expected rejection");
}

describe("listSeats", () => {
  it("returns seats sorted by seat id", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "3", data: () => ({ email: "c@x.com" }) },
        { id: "1", data: () => ({ email: "a@x.com" }) },
      ],
    });
    await expect(listSeats("c1")).resolves.toEqual([
      { seat: "1", email: "a@x.com" },
      { seat: "3", email: "c@x.com" },
    ]);
  });
});

describe("addUser", () => {
  it("normalizes the email and batch-writes the seat and allow-list docs", async () => {
    const seat = await addUser("c1", "  New@X.com ", "sa@x.com", []);
    expect(seat).toEqual({ seat: "1", email: "new@x.com" });
    expect(batchSet).toHaveBeenCalledWith(
      { path: "clinics/c1/seats/1" },
      { email: "new@x.com" },
    );
    const [ref, payload] = batchSet.mock.calls[1] as [
      { path: string },
      Record<string, unknown>,
    ];
    expect(ref.path).toBe("allowedEmails/new@x.com");
    expect(payload).toMatchObject({
      email: "new@x.com",
      clinicId: "c1",
      seat: "1",
      addedBy: "sa@x.com",
    });
    expect(typeof payload.addedAt).toBe("number");
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("uses the lowest free seat", async () => {
    const seat = await addUser("c1", "n@x.com", "sa", [
      { seat: "1", email: "a@x.com" },
      { seat: "3", email: "c@x.com" },
    ]);
    expect(seat.seat).toBe("2");
  });

  it("throws full without committing when all seats are taken", async () => {
    const seats = (["1", "2", "3"] as const).map((s) => ({
      seat: s,
      email: `${s}@x.com`,
    }));
    expect(await codeOf(addUser("c1", "n@x.com", "sa", seats))).toBe("full");
    expect(commit).not.toHaveBeenCalled();
  });

  it("throws duplicate when the email already holds a seat", async () => {
    const code = await codeOf(
      addUser("c1", " A@x.com", "sa", [{ seat: "1", email: "a@x.com" }]),
    );
    expect(code).toBe("duplicate");
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects the superadmin and invalid emails", async () => {
    expect(await codeOf(addUser("c1", SUPERADMIN_EMAIL, "sa", []))).toBe(
      "superadmin",
    );
    expect(await codeOf(addUser("c1", "not-an-email", "sa", []))).toBe(
      "invalid",
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it("maps permission-denied on commit to unavailable", async () => {
    commit.mockRejectedValue(
      new FirebaseError("permission-denied", "denied"),
    );
    expect(await codeOf(addUser("c1", "n@x.com", "sa", []))).toBe(
      "unavailable",
    );
  });

  it("rethrows other commit errors unchanged", async () => {
    const err = new Error("boom");
    commit.mockRejectedValue(err);
    await expect(addUser("c1", "n@x.com", "sa", [])).rejects.toBe(err);
  });
});

describe("removeUser", () => {
  it("refuses to remove the owner", async () => {
    const code = await codeOf(
      removeUser("c1", { seat: "1", email: "o@x.com" }, "o@x.com"),
    );
    expect(code).toBe("owner");
    expect(commit).not.toHaveBeenCalled();
  });

  it("batch-deletes the seat and allow-list docs", async () => {
    await removeUser("c1", { seat: "2", email: "u@x.com" }, "o@x.com");
    expect(batchDelete).toHaveBeenCalledWith({ path: "clinics/c1/seats/2" });
    expect(batchDelete).toHaveBeenCalledWith({ path: "allowedEmails/u@x.com" });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe("setOwner", () => {
  it("writes the normalized owner email onto the clinic", async () => {
    await setOwner("c1", " O@X.com ");
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "clinics/c1" },
      { ownerEmail: "o@x.com" },
    );
  });
});
