import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { db } from "./firebase";
import { CLINICS } from "./clinic";

/** The one account that can always sign in and manage who else can. Mirrored in firestore.rules. */
export const SUPERADMIN_EMAIL = "smartin.cherian@gmail.com";

/** Allowed emails are stored as `allowedEmails/{lowercased email}`. */
export const ALLOWED_EMAILS = "allowedEmails";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSuperadmin(email: string | null | undefined): boolean {
  return !!email && normalizeEmail(email) === SUPERADMIN_EMAIL;
}

export type Membership = {
  superadmin: boolean;
  clinicId: string | null;
  owner: boolean;
  /** Set when the superadmin turned off this user or their whole clinic. */
  inactive?: "user" | "clinic";
};

const isDenied = (err: unknown) =>
  err instanceof FirebaseError && err.code === "permission-denied";

/**
 * Resolves what the signed-in user may access: superadmin, a member of one clinic
 * (via their allow-list entry), or null (no access, or the read was permission-denied).
 * Any other failure (e.g. offline) is rethrown so callers don't mistake it for no access.
 */
export async function getMembership(user: User): Promise<Membership | null> {
  if (!user.email) return null;
  if (isSuperadmin(user.email))
    return { superadmin: true, clinicId: null, owner: false };
  try {
    const snap = await getDoc(
      doc(db, ALLOWED_EMAILS, normalizeEmail(user.email)),
    );
    if (!snap.exists()) return null;
    const clinicId = snap.data()?.clinicId;
    if (typeof clinicId !== "string" || !clinicId) return null;
    const userInactive = snap.data()?.active === false;
    let owner = false;
    let clinicInactive = false;
    try {
      const clinicSnap = await getDoc(doc(db, CLINICS, clinicId));
      const ownerEmail = clinicSnap.data()?.ownerEmail;
      owner =
        typeof ownerEmail === "string" &&
        normalizeEmail(ownerEmail) === normalizeEmail(user.email);
      clinicInactive = clinicSnap.data()?.active === false;
    } catch (err) {
      // A denied clinic read just means not owner; anything else is transient.
      if (!isDenied(err)) throw err;
    }
    const m: Membership = { superadmin: false, clinicId, owner };
    if (userInactive) m.inactive = "user";
    else if (clinicInactive) m.inactive = "clinic";
    return m;
  } catch (err) {
    // Rules deny the read for unverified accounts — treat as no access.
    if (isDenied(err)) return null;
    throw err;
  }
}

export function homePath(m: Membership): string {
  return m.superadmin ? "/admin" : `/${m.clinicId}/patients`;
}

/** Superadmin, or the owner of this very clinic. */
export function canManageClinic(
  m: Membership | undefined,
  clinicId: string | undefined,
): boolean {
  return (
    !!m && (m.superadmin || (m.owner && !!clinicId && clinicId === m.clinicId))
  );
}
