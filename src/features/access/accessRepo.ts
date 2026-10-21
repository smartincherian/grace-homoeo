import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ALLOWED_EMAILS, normalizeEmail } from "../../lib/access";

export interface AllowedEmail {
  email: string;
  clinicId: string;
  seat: string;
  addedAt: number;
  addedBy: string;
  /** False when the superadmin turned this user off. */
  active: boolean;
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
        seat: data.seat ?? "",
        addedAt: data.addedAt ?? 0,
        addedBy: data.addedBy ?? "",
        active: data.active !== false,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Deletes an allow-list entry that belongs to no clinic (superadmin only). */
export async function removeUnassignedEntry(email: string): Promise<void> {
  await deleteDoc(doc(db, ALLOWED_EMAILS, normalizeEmail(email)));
}
