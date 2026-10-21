import { doc, getDoc, writeBatch } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "../../lib/firebase";
import { CLINICS } from "../../lib/clinic";
import { ALLOWED_EMAILS, normalizeEmail } from "../../lib/access";
import { TRIAL_MS } from "../../lib/subscription";

/** A free slug reads as "not found"; a taken one is denied by the rules. */
export async function isSlugTaken(slug: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, CLINICS, slug));
    return snap.exists();
  } catch (err) {
    if (err instanceof FirebaseError && err.code === "permission-denied")
      return true;
    throw err;
  }
}

/** Creates the caller's own clinic, owner seat and allow-list entry in one batch. */
export async function createOwnClinic(
  slug: string,
  name: string,
  email: string,
  now: number = Date.now(),
): Promise<void> {
  const owner = normalizeEmail(email);
  const batch = writeBatch(db);
  batch.set(doc(db, CLINICS, slug), {
    name,
    createdAt: now,
    ownerEmail: owner,
    timeZone: "Asia/Kolkata",
    trialEndsAt: now + TRIAL_MS,
    authorized: false,
    authorizedAt: null,
    selfSignup: true,
  });
  batch.set(doc(db, CLINICS, slug, "seats", "1"), { email: owner });
  batch.set(doc(db, ALLOWED_EMAILS, owner), {
    email: owner,
    clinicId: slug,
    seat: "1",
    addedAt: now,
    addedBy: owner,
  });
  await batch.commit();
}
