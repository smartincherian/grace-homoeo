import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";

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

export type Membership = { superadmin: boolean; clinicId: string | null };

/**
 * Resolves what the signed-in user may access: superadmin, a member of one clinic
 * (via their allow-list entry), or null (no access, or the read was denied).
 */
export async function getMembership(user: User): Promise<Membership | null> {
  if (!user.email) return null;
  if (isSuperadmin(user.email)) return { superadmin: true, clinicId: null };
  try {
    const snap = await getDoc(doc(db, ALLOWED_EMAILS, normalizeEmail(user.email)));
    if (!snap.exists()) return null;
    const clinicId = snap.data()?.clinicId;
    return typeof clinicId === "string" && clinicId ? { superadmin: false, clinicId } : null;
  } catch {
    // Rules deny the read for unverified accounts — treat as no access.
    return null;
  }
}

export function homePath(m: Membership): string {
  return m.superadmin ? "/admin" : `/${m.clinicId}/patients`;
}

/** Temporary: removed in Task 4 once AuthGuard/LoginPage use getMembership. */
export async function hasAccess(user: User): Promise<boolean> {
  return Boolean(await getMembership(user));
}
