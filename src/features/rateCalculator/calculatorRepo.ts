import {
  collection,
  getDocs,
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  baseUnitLabel,
  isPriced,
  unitCostOf,
  type MedicineForm,
} from "../inventory/inventorySchema";

// Read-only access to the inventory collection for cost rates. The calculator
// owns this query (rather than importing the inventory feature) to respect
// feature boundaries — the same pattern Funds uses to read consultations.
const INVENTORY = "inventory";

export interface PricedItem {
  id: string;
  name: string;
  form: MedicineForm;
  unitCost: number;
  baseUnit: string;
}

/** Inventory items that carry cost data, lightest-form, sorted by name. */
export async function listPricedItems(): Promise<PricedItem[]> {
  const snap = await getDocs(
    query(collection(db, INVENTORY), orderBy("nameLower")),
  );
  return snap.docs
    .map((d) => {
      const data = d.data() as DocumentData;
      const form = (data.form ?? "flat") as MedicineForm;
      const purchaseCost = data.purchaseCost ?? 0;
      const lotSize = data.lotSize ?? 1;
      return {
        id: d.id,
        name: data.name as string,
        form,
        purchaseCost,
        lotSize,
      };
    })
    .filter((i) => isPriced(i))
    .map((i) => ({
      id: i.id,
      name: i.name,
      form: i.form,
      unitCost: unitCostOf(i),
      baseUnit: baseUnitLabel(i.form),
    }));
}
