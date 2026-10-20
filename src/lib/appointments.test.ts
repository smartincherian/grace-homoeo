import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const where = vi.fn((...a: unknown[]) => ({ where: a }));
vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  query: (...a: unknown[]) => ({ query: a }),
  where: (...a: unknown[]) => where(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("./clinic", () => ({
  clinicCollection: (n: string, c?: string) => ({
    path: `clinics/${c ?? "ACTIVE"}/${n}`,
  }),
}));

import {
  historyId,
  listAppointmentsForDay,
  listFutureAppointments,
} from "./appointments";

const mk = (id: string, start: number, end = start + 900_000) => ({
  id,
  data: () => ({
    date: 0,
    start,
    end,
    patientId: null,
    patientName: "A",
    phone: "1",
    serialNo: null,
    status: "booked",
    note: "",
    createdBy: "a@x.com",
    createdAt: 1,
    consultationId: null,
  }),
});

describe("appointments", () => {
  beforeEach(() => {
    getDocs.mockReset();
    where.mockClear();
  });
  it("historyId", () => {
    expect(historyId({ start: 5, createdAt: 7 })).toBe("5_7");
  });
  it("sorts a day by start and queries the given clinic", async () => {
    getDocs.mockResolvedValue({ docs: [mk("2", 200), mk("1", 100)] });
    const r = await listAppointmentsForDay("c9", 50);
    expect(r.map((a) => a.id)).toEqual(["1", "2"]);
    expect(where).toHaveBeenCalledWith("date", "==", 50);
    expect(getDocs.mock.calls[0][0].query[0]).toEqual({
      path: "clinics/c9/appointments",
    });
  });
  it("future: includes the running one, drops finished", async () => {
    const now = 10_000_000;
    getDocs.mockResolvedValue({
      docs: [
        mk("old", now - 3_000_000, now - 2_000_000),
        mk("run", now - 600_000, now + 300_000),
      ],
    });
    const r = await listFutureAppointments("c1", now);
    expect(where).toHaveBeenCalledWith("start", ">=", now - 2 * 3600_000);
    expect(r.map((a) => a.id)).toEqual(["run"]);
  });
});
