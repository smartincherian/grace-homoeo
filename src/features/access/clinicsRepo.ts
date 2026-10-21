import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
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
import { trialFields, type Clinic } from "../../lib/clinicQueries";
import { TRIAL_MS, clinicStatus } from "../../lib/subscription";

/** Expired first, then trials by days left, then authorized/legacy; names break ties. */
function attention(c: Clinic, now: number): number {
  const s = clinicStatus(c, now);
  if (s.kind === "expired") return -Infinity;
  return s.kind === "trial" ? s.daysLeft : Infinity;
}

/** All clinics: those needing attention first (see `attention`), then by name. */
export async function listClinics(now = Date.now()): Promise<Clinic[]> {
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
        active: data.active !== false,
        ...trialFields(data),
      };
    })
    .sort((a, b) => {
      const ra = attention(a, now);
      const rb = attention(b, now);
      if (ra !== rb) return ra < rb ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Creates a clinic with its owner on seat 1, in one batch. */
export async function createClinic(
  id: string,
  name: string,
  ownerEmail: string,
  addedBy: string,
  authorized = false,
  now = Date.now(),
): Promise<void> {
  const owner = normalizeEmail(ownerEmail);
  if (!EMAIL_RE.test(owner)) throw new SeatError("invalid");
  if (owner === SUPERADMIN_EMAIL) throw new SeatError("superadmin");
  const ref = doc(db, CLINICS, id);
  if ((await getDoc(ref)).exists()) throw new Error("Clinic already exists");

  const batch = writeBatch(db);
  batch.set(ref, {
    name,
    createdAt: now,
    ownerEmail: owner,
    timeZone: "Asia/Kolkata",
    trialEndsAt: now + TRIAL_MS,
    authorized,
    authorizedAt: authorized ? now : null,
    selfSignup: false,
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

/**
 * Authorizes a clinic (never expires) or removes that. A clinic with no trial
 * (legacy) that loses authorization gets `trialEndsAt = now`, so it is
 * read-only at once; one with a trial goes back to it.
 */
export async function setClinicAuthorized(
  clinic: Clinic,
  authorized: boolean,
  now = Date.now(),
): Promise<void> {
  await updateDoc(doc(db, CLINICS, clinic.id), {
    authorized,
    authorizedAt: authorized ? now : null,
    ...(!authorized && clinic.trialEndsAt === undefined
      ? { trialEndsAt: now }
      : {}),
  });
}
