import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type WriteBatch,
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
import {
  isGeneralsBlank,
  isLsmcRowBlank,
  type CaseRecordInput,
  type LsmcRowInput,
} from "./caseRecordSchema";

const COLLECTION = "consultations";
const PATIENTS = "patients";
const GENERALS = "generals";
const LSMC = "lsmc";

const toLsmcCells = (r: LsmcRowInput) => ({
  location: r.location.trim(),
  sensation: r.sensation.trim(),
  modality: r.modality.trim(),
  concomitant: r.concomitant.trim(),
});

function addNewLsmcRow(
  batch: WriteBatch,
  r: LsmcRowInput,
  link: { patientId: string; consultationId: string; date: number },
  now: number,
) {
  batch.set(doc(collection(db, LSMC)), {
    ...toLsmcCells(r),
    ...link,
    createdAt: now,
  });
}

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
    diagnosis: d.diagnosis ?? "",
    testsRequired: d.testsRequired ?? "",
    remedy: d.remedy ?? "",
    differentialRemedy: d.differentialRemedy ?? "",
    followupCriteria: d.followupCriteria ?? "",
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
  record: CaseRecordInput,
): Promise<string> {
  const now = Date.now();
  const batch = writeBatch(db);
  const ref = doc(collection(db, COLLECTION));
  batch.set(ref, {
    ...values,
    patientId: patient.id,
    patientName: patient.name,
    serialNo: patient.serialNo,
    createdAt: now,
  });
  const link = {
    patientId: patient.id,
    consultationId: ref.id,
    date: values.date,
  };
  if (record.generals && !isGeneralsBlank(record.generals)) {
    batch.set(doc(db, GENERALS, ref.id), {
      ...record.generals,
      ...link,
      updatedAt: now,
    });
  }
  for (const r of record.lsmc) {
    if (!isLsmcRowBlank(r)) addNewLsmcRow(batch, r, link, now);
  }
  // Stamp the patient's last visit in the same atomic batch (write by path,
  // not by importing the patients feature, to respect feature boundaries).
  batch.update(doc(db, PATIENTS, patient.id), { lastVisitAt: values.date });
  await batch.commit();
  return ref.id;
}

/**
 * Updates the consultation and syncs its case record in one batch.
 * Only form keys are written, so legacy per-visit text fields survive.
 * `existingLsmcIds` are the LSMC rows this visit had when the form loaded;
 * any not submitted (or submitted blank) are deleted.
 */
export async function updateConsultation(
  id: string,
  patientId: string,
  values: ConsultationFormValues,
  record: CaseRecordInput,
  existingLsmcIds: string[],
): Promise<void> {
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTION, id), { ...values });
  const link = { patientId, consultationId: id, date: values.date };

  if (record.generals) {
    const ref = doc(db, GENERALS, id);
    if (isGeneralsBlank(record.generals)) batch.delete(ref);
    else batch.set(ref, { ...record.generals, ...link, updatedAt: now });
  }

  const kept = new Set<string>();
  for (const r of record.lsmc) {
    if (isLsmcRowBlank(r)) continue;
    if (r.id && existingLsmcIds.includes(r.id)) {
      kept.add(r.id);
      batch.update(doc(db, LSMC, r.id), {
        ...toLsmcCells(r),
        date: values.date,
      });
    } else {
      addNewLsmcRow(batch, r, link, now);
    }
  }
  for (const lid of existingLsmcIds) {
    if (!kept.has(lid)) batch.delete(doc(db, LSMC, lid));
  }
  await batch.commit();
}
