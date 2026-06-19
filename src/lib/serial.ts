import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

export async function nextPatientSerial(): Promise<number> {
  const ref = doc(db, "counters", "patients");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists() ? (snap.data().lastSerial as number) : 0;
    const next = last + 1;
    tx.set(ref, { lastSerial: next }, { merge: true });
    return next;
  });
}
