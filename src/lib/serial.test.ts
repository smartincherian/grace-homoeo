import { describe, expect, it, vi, beforeEach } from "vitest";

const runTransaction = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const doc = vi.fn((..._a: unknown[]) => ({ id: "patients" }));
vi.mock("firebase/firestore", () => ({
  runTransaction: (...a: unknown[]) => runTransaction(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { nextPatientSerial } from "./serial";

describe("nextPatientSerial", () => {
  beforeEach(() => {
    runTransaction.mockReset();
  });

  it("returns 1 when no counter doc exists yet", async () => {
    runTransaction.mockImplementation(
      async (_db: unknown, fn: (tx: unknown) => unknown) =>
        fn({
          get: async () => ({ exists: () => false, data: () => ({}) }),
          set: vi.fn(),
        }),
    );
    await expect(nextPatientSerial()).resolves.toBe(1);
  });

  it("increments and persists the existing counter", async () => {
    const set = vi.fn();
    runTransaction.mockImplementation(
      async (_db: unknown, fn: (tx: unknown) => unknown) =>
        fn({
          get: async () => ({
            exists: () => true,
            data: () => ({ lastSerial: 41 }),
          }),
          set,
        }),
    );
    await expect(nextPatientSerial()).resolves.toBe(42);
    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      { lastSerial: 42 },
      { merge: true },
    );
  });
});
