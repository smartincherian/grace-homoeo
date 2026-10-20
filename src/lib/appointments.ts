import { useQuery } from "@tanstack/react-query";
import {
  getDocs,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { clinicCollection } from "./clinic";

export const APPOINTMENTS = "appointments";
export const APPOINTMENT_HISTORY = "appointmentHistory";

export type AppointmentStatus = "booked" | "arrived" | "done";

export interface Appointment {
  id: string;
  date: number;
  start: number;
  end: number;
  patientId: string | null;
  patientName: string;
  phone: string;
  serialNo: number | null;
  status: AppointmentStatus;
  note: string;
  createdBy: string;
  createdAt: number;
  consultationId: string | null;
}

export interface ClosedAppointment extends Omit<Appointment, "status"> {
  status: "cancelled" | "no-show";
  closedAt: number;
  closedBy: string;
}

export function historyId(a: { start: number; createdAt: number }): string {
  return `${a.start}_${a.createdAt}`;
}

export function toAppointment(
  snap: QueryDocumentSnapshot<DocumentData>,
): Appointment {
  const d = snap.data();
  return {
    id: snap.id,
    date: d.date,
    start: d.start,
    end: d.end,
    patientId: d.patientId ?? null,
    patientName: d.patientName ?? "",
    phone: d.phone ?? "",
    serialNo: d.serialNo ?? null,
    status: d.status,
    note: d.note ?? "",
    createdBy: d.createdBy ?? "",
    createdAt: d.createdAt,
    consultationId: d.consultationId ?? null,
  };
}

export async function listAppointmentsForDay(
  clinicId: string,
  dayStart: number,
): Promise<Appointment[]> {
  const snap = await getDocs(
    query(
      clinicCollection(APPOINTMENTS, clinicId),
      where("date", "==", dayStart),
    ),
  );
  return snap.docs.map(toAppointment).sort((a, b) => a.start - b.start);
}

/** Appointments still running or upcoming (a 2h lookback catches the one in progress). */
export async function listFutureAppointments(
  clinicId: string,
  now: number,
): Promise<Appointment[]> {
  const snap = await getDocs(
    query(
      clinicCollection(APPOINTMENTS, clinicId),
      where("start", ">=", now - 2 * 3600_000),
    ),
  );
  return snap.docs
    .map(toAppointment)
    .filter((a) => a.end > now)
    .sort((a, b) => a.start - b.start);
}

export function useDayAppointments(clinicId: string, dayStart: number) {
  return useQuery({
    queryKey: ["appointments", "day", clinicId, dayStart],
    queryFn: () => listAppointmentsForDay(clinicId, dayStart),
    enabled: !!clinicId,
    // A second device may book or mark arrivals while this one is open.
    refetchInterval: 60_000,
  });
}
