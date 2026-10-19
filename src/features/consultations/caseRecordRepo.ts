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
  type Generals,
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

export type FieldEntry = {
  value: string | number;
  date: number;
  consultationId: string;
};

/**
 * One general's values across visits, newest first. Blank means "no change"
 * at that visit; a repeated value collapses to the visit it was first entered.
 * `list` must be newest first.
 */
export function fieldHistory(
  list: GeneralsRecord[],
  key: keyof Generals,
): FieldEntry[] {
  const out: FieldEntry[] = [];
  for (const r of [...list].reverse()) {
    const raw = r[key];
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === "" || value == null) continue;
    if (out.length > 0 && out[out.length - 1].value === value) continue;
    out.push({ value, date: r.date, consultationId: r.consultationId });
  }
  return out.reverse();
}

/**
 * Records from visits before the one being entered: all of them for a new
 * visit, otherwise other visits dated on or before the edited one.
 */
export function priorRecords<
  T extends { consultationId: string; date: number },
>(list: T[], visit?: { id: string; date: number }): T[] {
  if (!visit) return list;
  return list.filter(
    (r) => r.consultationId !== visit.id && r.date <= visit.date,
  );
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
