import { getDoc, type DocumentReference } from "firebase/firestore";
import { clinicDoc } from "./clinic";

const APPOINTMENTS = "appointments";

/**
 * Best-effort linking: the appointment ref to update alongside a patient or
 * consultation save, or null when it is gone (cancelled meanwhile) or already
 * done. A missing appointment must never block saving the patient/consultation.
 */
export async function linkableAppointment(
  clinic: string,
  appointmentId: string,
): Promise<DocumentReference | null> {
  const ref = clinicDoc(APPOINTMENTS, appointmentId, clinic);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data()?.status === "done" ? null : ref;
}

/** Appointment fields clamped to what the Firestore rules accept. */
export function clampedLink(p: {
  patientName: string;
  phone?: string;
  serialNo: number;
}) {
  return {
    patientName: p.patientName.slice(0, 80),
    ...(p.phone === undefined ? {} : { phone: p.phone.slice(0, 20) }),
    serialNo: Number.isInteger(p.serialNo) ? p.serialNo : null,
  };
}
