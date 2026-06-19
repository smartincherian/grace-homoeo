import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type {
  Consultation,
  ConsultationFormValues,
  ConsultationPatientRef,
} from "./consultationSchema";

const COLLECTION = "consultations";
const PATIENTS = "patients";

function toConsultation(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Consultation {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    patientId: d.patientId,
    patientName: d.patientName,
    serialNo: d.serialNo,
    date: d.date,
    complaint: d.complaint ?? "",
    generals: d.generals ?? "",
    allergy: d.allergy ?? "",
    history: d.history ?? "",
    remedy: d.remedy ?? "",
    remarks: d.remarks ?? "",
    amount: d.amount,
    paymentMode: d.paymentMode,
    createdAt: d.createdAt,
  };
}

export async function listConsultationsByPatient(
  patientId: string,
): Promise<Consultation[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("patientId", "==", patientId)),
  );
  return snap.docs.map(toConsultation).sort((a, b) => b.date - a.date);
}

export async function getConsultation(
  id: string,
): Promise<Consultation | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toConsultation(snap) : null;
}

export async function createConsultation(
  patient: ConsultationPatientRef,
  values: ConsultationFormValues,
): Promise<string> {
  const batch = writeBatch(db);
  const ref = doc(collection(db, COLLECTION));
  batch.set(ref, {
    ...values,
    patientId: patient.id,
    patientName: patient.name,
    serialNo: patient.serialNo,
    createdAt: Date.now(),
  });
  // Stamp the patient's last visit in the same atomic batch (write by path,
  // not by importing the patients feature, to respect feature boundaries).
  batch.update(doc(db, PATIENTS, patient.id), { lastVisitAt: values.date });
  await batch.commit();
  return ref.id;
}

export async function updateConsultation(
  id: string,
  values: ConsultationFormValues,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...values });
}
