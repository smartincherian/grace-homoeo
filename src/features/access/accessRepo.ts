import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ALLOWED_EMAILS, normalizeEmail } from "../../lib/access";

export interface AllowedEmail {
  email: string;
  clinicId: string;
  addedAt: number;
  addedBy: string;
}

/** All allowed emails, alphabetically. */
export async function listAllowedEmails(): Promise<AllowedEmail[]> {
  const snap = await getDocs(collection(db, ALLOWED_EMAILS));
  return snap.docs
    .map((d) => {
      const data = d.data() as DocumentData;
      return {
        email: d.id,
        clinicId: data.clinicId ?? "",
        addedAt: data.addedAt ?? 0,
        addedBy: data.addedBy ?? "",
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function addAllowedEmail(
  email: string,
  clinicId: string,
  addedBy: string,
): Promise<void> {
  const id = normalizeEmail(email);
  await setDoc(doc(db, ALLOWED_EMAILS, id), {
    email: id,
    clinicId,
    addedAt: Date.now(),
    addedBy,
  });
}

export async function removeAllowedEmail(email: string): Promise<void> {
  await deleteDoc(doc(db, ALLOWED_EMAILS, normalizeEmail(email)));
}
