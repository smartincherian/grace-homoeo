import { HttpsError } from "firebase-functions/v2/https";
import { SUPER, type Deps } from "./deps.js";

export interface Caller {
  email: string;
  name: string;
  superadmin: boolean;
}
export interface ClinicInfo {
  id: string;
  type: "homoeo" | "general";
  ownerEmail: string;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DENIED = "You don't have access to this clinic.";

/** Mirrors the Firestore rules (member, entryActive, clinicActive, owner, trialOk) for callables. */
export async function assertAccess(
  deps: Deps,
  auth: { token: { email?: string; email_verified?: boolean; name?: string } } | undefined,
  clinicId: unknown,
  opts: { owner?: boolean; write?: boolean },
): Promise<{ caller: Caller; clinic: ClinicInfo }> {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to continue.");
  const email = (auth.token.email ?? "").toLowerCase();
  if (!email || auth.token.email_verified !== true) {
    throw new HttpsError("permission-denied", "Verify your email to continue.");
  }
  if (typeof clinicId !== "string" || !SLUG.test(clinicId)) {
    throw new HttpsError("invalid-argument", "Invalid clinic.");
  }
  const superadmin = email === SUPER;

  if (!superadmin) {
    const entry = await deps.store.get(`allowedEmails/${email}`);
    if (!entry || entry.clinicId !== clinicId || entry.active === false) {
      throw new HttpsError("permission-denied", DENIED);
    }
  }
  const doc = await deps.store.get(`clinics/${clinicId}`);
  if (!doc || (!superadmin && doc.active === false)) {
    throw new HttpsError("permission-denied", DENIED);
  }
  const ownerEmail = typeof doc.ownerEmail === "string" ? doc.ownerEmail.toLowerCase() : "";

  if (opts.owner && !superadmin && ownerEmail !== email) {
    throw new HttpsError("permission-denied", "Only the clinic owner can change the AI key.");
  }
  if (opts.write && !superadmin) {
    const ends = doc.trialEndsAt;
    const ok = doc.authorized === true || ends == null || deps.now() < Number(ends);
    if (!ok) {
      throw new HttpsError("failed-precondition", "The clinic's trial has ended.", {
        reason: "trial-ended",
      });
    }
  }
  return {
    caller: { email, name: auth.token.name ?? "", superadmin },
    clinic: { id: clinicId, type: doc.type === "general" ? "general" : "homoeo", ownerEmail },
  };
}
