import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { CLINICS } from "./clinic";

export interface Clinic {
  id: string;
  name: string;
  createdAt: number;
  ownerEmail?: string;
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
  };
}

export function useClinic(id: string | undefined) {
  return useQuery({
    queryKey: ["clinics", id],
    queryFn: () => getClinic(id!),
    enabled: !!id,
  });
}
