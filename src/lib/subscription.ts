import type { Clinic } from "./clinicQueries";

export const TRIAL_DAYS = 21;
export const TRIAL_MS = TRIAL_DAYS * 86_400_000;
export const WHATSAPP_NUMBER = "919036209639";

export type ClinicStatus =
  | { kind: "authorized" }
  | { kind: "legacy" }
  | { kind: "trial"; daysLeft: number }
  | { kind: "expired" };

export function clinicStatus(
  c: Pick<Clinic, "authorized" | "trialEndsAt">,
  now: number,
): ClinicStatus {
  if (c.authorized === true) return { kind: "authorized" };
  if (c.trialEndsAt === undefined) return { kind: "legacy" };
  if (now < c.trialEndsAt) {
    return {
      kind: "trial",
      daysLeft: Math.ceil((c.trialEndsAt - now) / 86_400_000),
    };
  }
  return { kind: "expired" };
}

/** True when the clinic may write (not trial-expired). */
export function trialOk(s: ClinicStatus): boolean {
  return s.kind !== "expired";
}

export function pricingWhatsAppUrl(p: {
  clinicName: string;
  clinicId: string;
  email: string;
}): string {
  const msg = `Hi, I'd like to know the ClinicDesk subscription pricing. Clinic: ${p.clinicName} (${p.clinicId}), email: ${p.email}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
