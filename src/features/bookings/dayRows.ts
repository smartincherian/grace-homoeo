import type { Appointment, ClosedAppointment } from "../../lib/appointments";

export interface DayRow {
  start: number;
  end: number;
  appointment?: Appointment;
  history: ClosedAppointment[];
}

/**
 * One row per slot, appointment or history start, sorted by time. Free rows
 * that have already ended are dropped; rows with an appointment or history
 * are always kept (they may be past, or off the grid on a holiday).
 */
export function dayRows(
  slots: { start: number; end: number }[],
  appointments: Appointment[],
  history: ClosedAppointment[],
  now: number,
): DayRow[] {
  const byStart = new Map<number, DayRow>();
  const rowFor = (start: number, end: number) => {
    let row = byStart.get(start);
    if (!row) {
      row = { start, end, history: [] };
      byStart.set(start, row);
    }
    return row;
  };
  for (const s of slots) rowFor(s.start, s.end);
  for (const a of appointments) rowFor(a.start, a.end).appointment = a;
  for (const h of history) rowFor(h.start, h.end).history.push(h);
  return [...byStart.values()]
    .filter((r) => r.appointment || r.history.length > 0 || r.end > now)
    .sort((a, b) => a.start - b.start)
    .map((r) => ({
      ...r,
      history: [...r.history].sort((a, b) => a.closedAt - b.closedAt),
    }));
}
