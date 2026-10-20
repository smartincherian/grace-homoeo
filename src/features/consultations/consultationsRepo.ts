import {
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
import { clinicCollection, clinicDoc, getActiveClinic } from "../../lib/clinic";
import { clampedLink, linkableAppointment } from "../../lib/appointmentLink";
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
  createdAt: number,
  clinic?: string,
) {
  batch.set(doc(clinicCollection(LSMC, clinic)), {
    ...toLsmcCells(r),
    ...link,
    createdAt,
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
    query(clinicCollection(COLLECTION), where("patientId", "==", patientId)),
  );
  return snap.docs.map(toConsultation).sort((a, b) => b.date - a.date);
}

export async function getConsultation(
  id: string,
): Promise<Consultation | null> {
  const snap = await getDoc(clinicDoc(COLLECTION, id));
  return snap.exists() ? toConsultation(snap) : null;
}

export async function createConsultation(
  patient: ConsultationPatientRef,
  values: ConsultationFormValues,
  record: CaseRecordInput,
  appointmentId?: string,
): Promise<string> {
  // Pin the clinic: the active one may change while the appointment is read.
  const clinic = getActiveClinic();
  const appt = appointmentId
    ? await linkableAppointment(clinic, appointmentId)
    : null;
  const now = Date.now();
  const batch = writeBatch(db);
  const ref = doc(clinicCollection(COLLECTION, clinic));
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
    batch.set(clinicDoc(GENERALS, ref.id, clinic), {
      ...record.generals,
      ...link,
      updatedAt: now,
    });
  }
  // createdAt + n keeps rows entered together in entry order.
  let n = 0;
  for (const r of record.lsmc) {
    if (!isLsmcRowBlank(r)) addNewLsmcRow(batch, r, link, now + n++, clinic);
  }
  // Stamp the patient's last visit in the same atomic batch (write by path,
  // not by importing the patients feature, to respect feature boundaries).
  batch.update(clinicDoc(PATIENTS, patient.id, clinic), {
    lastVisitAt: values.date,
  });
  if (appt) {
    batch.update(appt, {
      status: "done",
      consultationId: ref.id,
      patientId: patient.id,
      ...clampedLink({ patientName: patient.name, serialNo: patient.serialNo }),
    });
  }
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
  batch.update(clinicDoc(COLLECTION, id), { ...values });
  const link = { patientId, consultationId: id, date: values.date };

  if (record.generals) {
    const ref = clinicDoc(GENERALS, id);
    if (isGeneralsBlank(record.generals)) batch.delete(ref);
    else batch.set(ref, { ...record.generals, ...link, updatedAt: now });
  }

  const kept = new Set<string>();
  let n = 0;
  for (const r of record.lsmc) {
    if (isLsmcRowBlank(r)) continue;
    if (r.id && existingLsmcIds.includes(r.id)) {
      kept.add(r.id);
      batch.update(clinicDoc(LSMC, r.id), {
        ...toLsmcCells(r),
        date: values.date,
      });
    } else {
      addNewLsmcRow(batch, r, link, now + n++);
    }
  }
  for (const lid of existingLsmcIds) {
    if (!kept.has(lid)) batch.delete(clinicDoc(LSMC, lid));
  }
  await batch.commit();
}
