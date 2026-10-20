import { dayRows } from "./dayRows";
import type { Appointment, ClosedAppointment } from "../../lib/appointments";

const M = 60_000;
const T0 = Date.UTC(2026, 10, 2, 4, 0); // 09:30 Kolkata
const slots = [0, 15, 30].map((m) => ({
  start: T0 + m * M,
  end: T0 + (m + 15) * M,
}));

const appt = (start: number, over: Partial<Appointment> = {}): Appointment => ({
  id: String(start),
  date: 0,
  start,
  end: start + 15 * M,
  patientId: null,
  patientName: "Asha",
  phone: "9876543210",
  serialNo: null,
  status: "booked",
  note: "",
  createdBy: "a@x.com",
  createdAt: 1,
  consultationId: null,
  ...over,
});
const closed = (start: number, createdAt = 1): ClosedAppointment => ({
  ...appt(start, { createdAt }),
  status: "cancelled",
  closedAt: 2,
  closedBy: "a@x.com",
});

test("keeps every slot before they start, sorted", () => {
  const rows = dayRows(slots, [], [], T0 - 60 * M);
  expect(rows.map((r) => r.start)).toEqual(slots.map((s) => s.start));
  expect(rows[0]).toEqual({ ...slots[0], isSlot: true, history: [] });
});

test("drops past free slots but keeps the running one and a past booked one", () => {
  const now = T0 + 20 * M; // inside the second slot
  const rows = dayRows(slots, [appt(T0)], [], now);
  expect(rows.map((r) => r.start)).toEqual([T0, T0 + 15 * M, T0 + 30 * M]);
  expect(rows[0].appointment?.patientName).toBe("Asha");
  const rows2 = dayRows(slots, [], [], now);
  expect(rows2.map((r) => r.start)).toEqual([T0 + 15 * M, T0 + 30 * M]);
});

test("an appointment off the slot grid (holiday: no slots) still gets a row", () => {
  const off = T0 + 7 * M;
  const rows = dayRows([], [appt(off)], [], T0);
  expect(rows).toHaveLength(1);
  expect(rows[0].start).toBe(off);
  expect(rows[0].end).toBe(off + 15 * M);
  expect(rows[0].appointment?.id).toBe(String(off));
});

test("history attaches to its row, including a free slot after a cancel", () => {
  const rows = dayRows(
    slots,
    [appt(T0, { createdAt: 5 })],
    [closed(T0, 1), closed(T0 + 30 * M)],
    T0 - M,
  );
  expect(rows[0].appointment?.createdAt).toBe(5);
  expect(rows[0].history).toHaveLength(1);
  expect(rows[2].appointment).toBeUndefined();
  expect(rows[2].history).toHaveLength(1);
  expect(rows[1].history).toEqual([]);
});

test("a past free slot with history is kept", () => {
  const rows = dayRows(slots, [], [closed(T0)], T0 + 60 * M);
  expect(rows.map((r) => r.start)).toEqual([T0]);
});

test("only rows on the computed slot grid are slots", () => {
  const off = T0 + 7 * M;
  // Holiday: no slots; a cancelled booking and an off-grid one remain.
  const rows = dayRows([], [appt(off)], [closed(T0)], T0 - M);
  expect(rows.map((r) => [r.start, r.isSlot])).toEqual([
    [T0, false],
    [off, false],
  ]);
  const grid = dayRows(slots, [], [closed(T0)], T0 - M);
  expect(grid[0].isSlot).toBe(true);
});
