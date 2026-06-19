import { z } from "zod";

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
