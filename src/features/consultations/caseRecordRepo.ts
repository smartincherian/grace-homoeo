import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  EMPTY_GENERALS,
  GENERALS_KEYS,
  type GeneralsRecord,
  type LsmcRow,
} from "./caseRecordSchema";

// Reads only; writes happen in the consultation batch (consultationsRepo.ts).
const GENERALS = "generals";
const LSMC = "lsmc";

function toGenerals(id: string, d: DocumentData): GeneralsRecord {
  const fields = { ...EMPTY_GENERALS };
  for (const k of GENERALS_KEYS) {
    if (d[k] !== undefined) (fields as Record<string, unknown>)[k] = d[k];
  }
  return {
    ...fields,
    id,
    patientId: d.patientId,
    consultationId: d.consultationId,
    date: d.date,
    updatedAt: d.updatedAt ?? 0,
  };
}

function toLsmc(id: string, d: DocumentData): LsmcRow {
  return {
    id,
    patientId: d.patientId,
    consultationId: d.consultationId,
    date: d.date,
    location: d.location ?? "",
    sensation: d.sensation ?? "",
    modality: d.modality ?? "",
    concomitant: d.concomitant ?? "",
    createdAt: d.createdAt ?? 0,
  };
}

export async function getConsultationGenerals(
  cid: string,
): Promise<GeneralsRecord | null> {
  const snap = await getDoc(doc(db, GENERALS, cid));
  return snap.exists() ? toGenerals(snap.id, snap.data()) : null;
}

/** All generals snapshots for a patient, newest first. */
export async function listPatientGenerals(
  patientId: string,
): Promise<GeneralsRecord[]> {
  const snap = await getDocs(
    query(collection(db, GENERALS), where("patientId", "==", patientId)),
  );
  return snap.docs
    .map((s) => toGenerals(s.id, s.data()))
    .sort((a, b) => b.date - a.date || b.updatedAt - a.updatedAt);
}

export function latestGenerals(list: GeneralsRecord[]): GeneralsRecord | null {
  return list[0] ?? null;
}

/** Latest snapshot strictly before `date`; `list` must be newest first. */
export function latestGeneralsBefore(
  list: GeneralsRecord[],
  date: number,
): GeneralsRecord | null {
  return list.find((g) => g.date < date) ?? null;
}

/** Newest visit first; rows within a visit in entry order. */
export async function listLsmcByPatient(patientId: string): Promise<LsmcRow[]> {
  const snap = await getDocs(
    query(collection(db, LSMC), where("patientId", "==", patientId)),
  );
  return snap.docs
    .map((s) => toLsmc(s.id, s.data()))
    .sort((a, b) => b.date - a.date || a.createdAt - b.createdAt);
}

export async function listLsmcByConsultation(cid: string): Promise<LsmcRow[]> {
  const snap = await getDocs(
    query(collection(db, LSMC), where("consultationId", "==", cid)),
  );
  return snap.docs
    .map((s) => toLsmc(s.id, s.data()))
    .sort((a, b) => a.createdAt - b.createdAt);
}
