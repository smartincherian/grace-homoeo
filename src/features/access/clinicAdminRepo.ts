import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
  type Query,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { CLINICS } from "../../lib/clinic";
import { ALLOWED_EMAILS, normalizeEmail } from "../../lib/access";
import type { ClinicType } from "../../lib/clinicType";

/**
 * Every subcollection a clinic can hold. Keep in sync with firestore.rules:
 * anything else is denied, so nothing else can exist under clinics/{id}.
 */
export const CLINIC_COLLECTIONS = [
  "patients",
  "consultations",
  "generals",
  "lsmc",
  "inventory",
  "orderItems",
  "expenses",
  "counters",
  "appointments",
  "appointmentHistory",
  "staff",
  "leaves",
  "salaryPayments",
  "settings",
  "seats",
] as const;

// Below Firestore's 500-writes-per-batch cap.
const PAGE = 400;

/** Turns a whole clinic on or off for its members (superadmin only). */
export async function setClinicActive(
  id: string,
  active: boolean,
): Promise<void> {
  await updateDoc(doc(db, CLINICS, id), { active });
}

/** Changes which case-taking parts a clinic shows (superadmin only). */
export async function setClinicType(
  id: string,
  type: ClinicType,
): Promise<void> {
  await updateDoc(doc(db, CLINICS, id), { type });
}

/** Turns one user's access on or off; their seat is kept (superadmin only). */
export async function setUserActive(
  email: string,
  active: boolean,
): Promise<void> {
  await updateDoc(doc(db, ALLOWED_EMAILS, normalizeEmail(email)), { active });
}

async function deleteAll(q: Query): Promise<void> {
  for (;;) {
    const snap = await getDocs(query(q, limit(PAGE)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

/**
 * Permanently deletes a clinic: its users' access first (so no one keeps
 * working in it), then all its data, then the clinic doc. Safe to re-run
 * after a failure; it picks up whatever is left.
 */
export async function deleteClinic(
  id: string,
  onStep?: (step: string) => void,
): Promise<void> {
  onStep?.("users");
  await deleteAll(
    query(collection(db, ALLOWED_EMAILS), where("clinicId", "==", id)),
  );
  for (const name of CLINIC_COLLECTIONS) {
    onStep?.(name);
    await deleteAll(collection(db, CLINICS, id, name));
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, CLINICS, id));
  await batch.commit();
}
