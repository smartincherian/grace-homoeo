import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { clinicCollection, clinicDoc, getActiveClinic } from "../../lib/clinic";
import { nextPatientSerial } from "../../lib/serial";
import { clampedLink, linkableAppointment } from "../../lib/appointmentLink";
import type { Patient, PatientFormValues } from "./patientSchema";

const COLLECTION = "patients";

function toPatient(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Patient {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: d.name,
    nameLower: d.nameLower,
    dob: typeof d.dob === "number" ? d.dob : null,
    gender: d.gender,
    place: d.place ?? "",
    phone: d.phone ?? "",
    serialNo: d.serialNo,
    createdAt: d.createdAt,
    lastVisitAt: d.lastVisitAt ?? null,
  };
}

export async function listPatients(): Promise<Patient[]> {
  const snap = await getDocs(
    query(clinicCollection(COLLECTION), orderBy("nameLower")),
  );
  return snap.docs.map(toPatient);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const snap = await getDoc(clinicDoc(COLLECTION, id));
  return snap.exists() ? toPatient(snap) : null;
}

export async function createPatient(
  values: PatientFormValues,
  appointmentId?: string,
): Promise<string> {
  // Pin the clinic: the active one may change while the serial is awaited.
  const clinic = getActiveClinic();
  // Read the link first so a failed read can never burn a serial.
  const appt = appointmentId
    ? await linkableAppointment(clinic, appointmentId)
    : null;
  const serialNo = await nextPatientSerial(clinic);
  const data = {
    ...values,
    nameLower: values.name.toLowerCase(),
    serialNo,
    createdAt: Date.now(),
    lastVisitAt: null,
  };
  if (!appointmentId) {
    const ref = await addDoc(clinicCollection(COLLECTION, clinic), data);
    return ref.id;
  }
  const ref = doc(clinicCollection(COLLECTION, clinic));
  const commit = async (link: boolean) => {
    const batch = writeBatch(db);
    batch.set(ref, data);
    if (link && appt) {
      batch.update(appt, {
        patientId: ref.id,
        ...clampedLink({
          patientName: values.name,
          phone: values.phone,
          serialNo,
        }),
      });
    }
    await batch.commit();
  };
  try {
    await commit(true);
  } catch (e) {
    // The appointment may have vanished since the read: save the patient anyway.
    if (!appt) throw e;
    await commit(false);
  }
  return ref.id;
}

export async function updatePatient(
  id: string,
  values: PatientFormValues,
): Promise<void> {
  await updateDoc(clinicDoc(COLLECTION, id), {
    ...values,
    nameLower: values.name.toLowerCase(),
  });
}

// Collections whose docs belong to one patient (via `patientId`).
const PATIENT_OWNED = ["consultations", "generals", "lsmc"];
// Firestore caps a write batch at 500 operations.
const BATCH_LIMIT = 500;

/**
 * Deletes a patient together with their consultations and case record
 * (generals, LSMC), so no orphaned visits are left behind. Their consultation
 * fees drop out of the Funds income totals.
 */
export async function deletePatient(id: string): Promise<void> {
  // Pin the clinic: the active one may change while the queries are awaited.
  const clinic = getActiveClinic();
  const owned = await Promise.all(
    PATIENT_OWNED.map((name) =>
      getDocs(
        query(clinicCollection(name, clinic), where("patientId", "==", id)),
      ),
    ),
  );
  const refs: DocumentReference[] = [
    ...owned.flatMap((snap) => snap.docs.map((d) => d.ref)),
    clinicDoc("patientSummaries", id, clinic),
    // Patient last, so a partial failure never leaves visits without a patient.
    clinicDoc(COLLECTION, id, clinic),
  ];
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(i, i + BATCH_LIMIT).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}
