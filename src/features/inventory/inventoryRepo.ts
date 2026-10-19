import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { clinicCollection, clinicDoc } from "../../lib/clinic";
import type { InventoryItem, InventoryFormValues } from "./inventorySchema";

const COLLECTION = "inventory";

function toItem(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): InventoryItem {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: d.name,
    nameLower: d.nameLower,
    quantity: d.quantity,
    unit: d.unit ?? "",
    reorderLevel: d.reorderLevel ?? 0,
    notes: d.notes ?? "",
    form: d.form ?? "flat",
    purchaseCost: d.purchaseCost ?? 0,
    lotSize: d.lotSize ?? 1,
    updatedAt: d.updatedAt,
  };
}

export async function listInventory(): Promise<InventoryItem[]> {
  const snap = await getDocs(
    query(clinicCollection(COLLECTION), orderBy("nameLower")),
  );
  return snap.docs.map(toItem);
}

export async function getItem(id: string): Promise<InventoryItem | null> {
  const snap = await getDoc(clinicDoc(COLLECTION, id));
  return snap.exists() ? toItem(snap) : null;
}

export async function createItem(values: InventoryFormValues): Promise<string> {
  const ref = await addDoc(clinicCollection(COLLECTION), {
    ...values,
    nameLower: values.name.toLowerCase(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateItem(
  id: string,
  values: InventoryFormValues,
): Promise<void> {
  await updateDoc(clinicDoc(COLLECTION, id), {
    ...values,
    nameLower: values.name.toLowerCase(),
    updatedAt: Date.now(),
  });
}

export async function setQuantity(id: string, quantity: number): Promise<void> {
  await updateDoc(clinicDoc(COLLECTION, id), {
    quantity,
    updatedAt: Date.now(),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(clinicDoc(COLLECTION, id));
}
