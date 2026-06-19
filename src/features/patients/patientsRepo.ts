import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { nextPatientSerial } from "../../lib/serial";
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
    dob: d.dob,
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
    query(collection(db, COLLECTION), orderBy("nameLower")),
  );
  return snap.docs.map(toPatient);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toPatient(snap) : null;
}

export async function createPatient(
  values: PatientFormValues,
): Promise<string> {
  const serialNo = await nextPatientSerial();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...values,
    nameLower: values.name.toLowerCase(),
    serialNo,
    createdAt: Date.now(),
    lastVisitAt: null,
  });
  return ref.id;
}

export async function updatePatient(
  id: string,
  values: PatientFormValues,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...values,
    nameLower: values.name.toLowerCase(),
  });
}
