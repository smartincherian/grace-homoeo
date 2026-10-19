import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { CLINICS } from "../../lib/clinic";
import type { Clinic } from "../../lib/clinicQueries";

/** All clinics, alphabetically by name. */
export async function listClinics(): Promise<Clinic[]> {
  const snap = await getDocs(collection(db, CLINICS));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return { id: d.id, name: data.name ?? "", createdAt: data.createdAt ?? 0 };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createClinic(id: string, name: string): Promise<void> {
  const ref = doc(db, CLINICS, id);
  if ((await getDoc(ref)).exists()) throw new Error("Clinic already exists");
  await setDoc(ref, { name, createdAt: Date.now() });
}
