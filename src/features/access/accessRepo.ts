import { collection, getDocs, type DocumentData } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ALLOWED_EMAILS } from "../../lib/access";

export interface AllowedEmail {
  email: string;
  clinicId: string;
  seat: string;
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
        seat: data.seat ?? "",
        addedAt: data.addedAt ?? 0,
        addedBy: data.addedBy ?? "",
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}
