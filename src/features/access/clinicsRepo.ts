import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { CLINICS } from "../../lib/clinic";
import {
  ALLOWED_EMAILS,
  SUPERADMIN_EMAIL,
  normalizeEmail,
} from "../../lib/access";
import { EMAIL_RE, SeatError } from "../../lib/seats";
import type { Clinic } from "../../lib/clinicQueries";

/** All clinics, alphabetically by name. */
export async function listClinics(): Promise<Clinic[]> {
  const snap = await getDocs(collection(db, CLINICS));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? "",
        createdAt: data.createdAt ?? 0,
        ownerEmail:
          typeof data.ownerEmail === "string" ? data.ownerEmail : undefined,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Creates a clinic with its owner on seat 1, in one batch. */
export async function createClinic(
  id: string,
  name: string,
  ownerEmail: string,
  addedBy: string,
): Promise<void> {
  const owner = normalizeEmail(ownerEmail);
  if (!EMAIL_RE.test(owner)) throw new SeatError("invalid");
  if (owner === SUPERADMIN_EMAIL) throw new SeatError("superadmin");
  const ref = doc(db, CLINICS, id);
  if ((await getDoc(ref)).exists()) throw new Error("Clinic already exists");

  const now = Date.now();
  const batch = writeBatch(db);
  batch.set(ref, {
    name,
    createdAt: now,
    ownerEmail: owner,
    timeZone: "Asia/Kolkata",
  });
  batch.set(doc(db, CLINICS, id, "seats", "1"), { email: owner });
  batch.set(doc(db, ALLOWED_EMAILS, owner), {
    email: owner,
    clinicId: id,
    seat: "1",
    addedAt: now,
    addedBy,
  });
  await batch.commit();
}
