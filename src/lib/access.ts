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

/** True when the signed-in user is the superadmin or their email is on the allow list. */
export async function hasAccess(user: User): Promise<boolean> {
  if (!user.email) return false;
  if (isSuperadmin(user.email)) return true;
  try {
    const snap = await getDoc(doc(db, ALLOWED_EMAILS, normalizeEmail(user.email)));
    return snap.exists();
  } catch {
    // Rules deny the read for unverified accounts — treat as no access.
    return false;
  }
}
