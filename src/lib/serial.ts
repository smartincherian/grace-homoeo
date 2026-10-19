import { runTransaction } from "firebase/firestore";
import { db } from "./firebase";
import { clinicDoc } from "./clinic";

export async function nextPatientSerial(clinicId?: string): Promise<number> {
  const ref = clinicDoc("counters", "patients", clinicId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists() ? (snap.data().lastSerial as number) : 0;
    const next = last + 1;
    tx.set(ref, { lastSerial: next }, { merge: true });
    return next;
  });
}
