import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CLINICS } from "./clinic";

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export interface Clinic {
  id: string;
  name: string;
  createdAt: number;
  ownerEmail?: string;
  timeZone?: string;
  /** False when the superadmin turned the clinic off; listClinics always sets it. */
  active?: boolean;
  /** Superadmin-authorized (paid): never expires. */
  authorized?: boolean;
  authorizedAt?: number | null;
  /** Epoch ms when the free trial ends; absent for legacy clinics. */
  trialEndsAt?: number;
  selfSignup?: boolean;
}

/** Trial fields from a clinic doc's data, with type guards (absent -> undefined). */
export function trialFields(
  data: Record<string, unknown>,
): Pick<Clinic, "authorized" | "authorizedAt" | "trialEndsAt" | "selfSignup"> {
  return {
    authorized:
      typeof data.authorized === "boolean" ? data.authorized : undefined,
    authorizedAt:
      typeof data.authorizedAt === "number" || data.authorizedAt === null
        ? data.authorizedAt
        : undefined,
    trialEndsAt:
      typeof data.trialEndsAt === "number" ? data.trialEndsAt : undefined,
    selfSignup:
      typeof data.selfSignup === "boolean" ? data.selfSignup : undefined,
  };
}

export async function getClinic(id: string): Promise<Clinic | null> {
  const snap = await getDoc(doc(db, CLINICS, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name ?? "",
    createdAt: data.createdAt ?? 0,
    ownerEmail:
      typeof data.ownerEmail === "string" ? data.ownerEmail : undefined,
    timeZone: typeof data.timeZone === "string" ? data.timeZone : undefined,
    ...trialFields(data),
  };
}

export function useClinic(id: string | undefined) {
  return useQuery({
    queryKey: ["clinics", id],
    queryFn: () => getClinic(id!),
    enabled: !!id,
  });
}

export function useClinicTimeZone(clinicId: string | undefined): string {
  return useClinic(clinicId).data?.timeZone ?? DEFAULT_TIME_ZONE;
}
