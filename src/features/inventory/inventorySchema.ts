import { z } from "zod";

export const MEDICINE_FORMS = [
  "pieces",
  "liquid",
  "packaging",
  "flat",
] as const;
export type MedicineForm = (typeof MEDICINE_FORMS)[number];

/** Human label for the base unit a form's per-unit cost is measured in. */
export function baseUnitLabel(form: MedicineForm): string {
  switch (form) {
    case "pieces":
      return "pill";
    case "liquid":
      return "ml";
    case "packaging":
      return "bottle";
    case "flat":
      return "unit";
  }
}

export const inventoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .nonnegative("Quantity cannot be negative"),
  unit: z.string().trim().default(""),
  reorderLevel: z
    .number({ invalid_type_error: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .nonnegative("Reorder level cannot be negative")
    .default(0),
  notes: z.string().trim().default(""),
  form: z.enum(MEDICINE_FORMS).default("flat"),
  purchaseCost: z
    .number({ invalid_type_error: "Cost must be a number" })
    .nonnegative("Cost cannot be negative")
    .default(0),
  lotSize: z
    .number({ invalid_type_error: "Lot size must be a number" })
    .positive("Lot size must be greater than zero")
    .default(1),
});

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

export interface InventoryItem extends InventoryFormValues {
  id: string;
  nameLower: string;
  updatedAt: number;
}

export function isLowStock(
  item: Pick<InventoryItem, "quantity" | "reorderLevel">,
): boolean {
  return item.quantity <= item.reorderLevel;
}

/** Per-base-unit cost derived from the bulk purchase (₹0 when not priced). */
export function unitCostOf(
  item: Pick<InventoryItem, "purchaseCost" | "lotSize">,
): number {
  return item.lotSize > 0 ? item.purchaseCost / item.lotSize : 0;
}

/** True when the item carries enough cost data to use in the calculator. */
export function isPriced(
  item: Pick<InventoryItem, "purchaseCost" | "lotSize">,
): boolean {
  return item.purchaseCost > 0 && item.lotSize > 0;
}
