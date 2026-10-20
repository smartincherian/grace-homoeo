import {
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  APPOINTMENT_HISTORY,
  APPOINTMENTS,
  historyId,
  type Appointment,
  type ClosedAppointment,
} from "../../lib/appointments";
import { clinicCollection, clinicDoc, getActiveClinic } from "../../lib/clinic";
import { db } from "../../lib/firebase";
import { dayStartInZone } from "../../lib/zonedDates";
import type { BookingFormValues } from "./bookingSchema";

export class SlotTakenError extends Error {
  constructor() {
    super("Slot just taken");
    this.name = "SlotTakenError";
  }
}

export async function bookAppointment(
  slot: { start: number; end: number },
  values: BookingFormValues,
  by: string,
  tz: string,
): Promise<void> {
  const clinicId = getActiveClinic();
  const ref = clinicDoc(APPOINTMENTS, String(slot.start), clinicId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) throw new SlotTakenError();
    tx.set(ref, {
      date: dayStartInZone(slot.start, tz),
      start: slot.start,
      end: slot.end,
      patientId: values.patientId,
      patientName: values.patientName,
      phone: values.phone,
      serialNo: values.serialNo,
      status: "booked",
      note: values.note,
      createdBy: by,
      createdAt: Date.now(),
      consultationId: null,
    });
  });
}

export async function closeAppointment(
  a: Appointment,
  status: "cancelled" | "no-show",
  by: string,
): Promise<void> {
  const clinicId = getActiveClinic();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = a;
  const batch = writeBatch(db);
  batch.set(clinicDoc(APPOINTMENT_HISTORY, historyId(a), clinicId), {
    ...rest,
    status,
    closedAt: Date.now(),
    closedBy: by,
  });
  batch.delete(clinicDoc(APPOINTMENTS, a.id, clinicId));
  await batch.commit();
}

export async function markArrived(id: string): Promise<void> {
  const clinicId = getActiveClinic();
  await updateDoc(clinicDoc(APPOINTMENTS, id, clinicId), { status: "arrived" });
}

export async function listDayHistory(
  clinicId: string,
  dayStart: number,
): Promise<ClosedAppointment[]> {
  const snap = await getDocs(
    query(
      clinicCollection(APPOINTMENT_HISTORY, clinicId),
      where("date", "==", dayStart),
    ),
  );
  return snap.docs
    .map((s) => {
      const d = s.data();
      return {
        id: s.id,
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
        closedAt: d.closedAt,
        closedBy: d.closedBy ?? "",
      } as ClosedAppointment;
    })
    .sort((a, b) => a.start - b.start);
}

export interface PatientChoice {
  id: string;
  name: string;
  serialNo: number;
  phone: string;
}

export async function listPatientChoices(): Promise<PatientChoice[]> {
  const snap = await getDocs(
    query(clinicCollection("patients"), orderBy("nameLower")),
  );
  return snap.docs.map((s) => {
    const d = s.data();
    return {
      id: s.id,
      name: d.name,
      serialNo: d.serialNo,
      phone: d.phone ?? "",
    };
  });
}
