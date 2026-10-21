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
