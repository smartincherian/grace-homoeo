import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { OrderFormValues, OrderItem } from "./orderSchema";

const COLLECTION = "orderItems";

function toOrderItem(snap: QueryDocumentSnapshot<DocumentData>): OrderItem {
  const d = snap.data();
  return {
    id: snap.id,
    // Findrops used to be its own category; it is now a syrup name.
    category: d.category === "findrops" ? "syrups" : d.category,
    name: d.name ?? "",
    nameLower: d.nameLower ?? "",
    variant: d.variant ?? "",
    quantity: d.quantity ?? "",
    ordered: d.ordered ?? false,
    createdAt: d.createdAt,
  };
}

/**
 * Every order entry, oldest first. Ordered entries are kept (not deleted)
 * so their names stay available as autofill suggestions.
 */
export async function listOrderItems(): Promise<OrderItem[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("createdAt")),
  );
  return snap.docs.map(toOrderItem);
}

export async function createOrderItem(values: OrderFormValues): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...values,
    nameLower: values.name.toLowerCase(),
    ordered: false,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function markOrdered(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ordered: true,
    orderedAt: Date.now(),
  });
}

export async function deleteOrderItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
