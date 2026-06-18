import { describe, expect, it } from "vitest";
import { inventoryFormSchema, isLowStock } from "./inventorySchema";

describe("inventoryFormSchema", () => {
  it("accepts a valid item and trims the name", () => {
    const parsed = inventoryFormSchema.parse({
      name: "  Arnica 30  ", quantity: 12, unit: "vials", reorderLevel: 3, notes: "shelf A",
    });
    expect(parsed.name).toBe("Arnica 30");
    expect(parsed.quantity).toBe(12);
  });
  it("rejects an empty name", () => {
    expect(() => inventoryFormSchema.parse({ name: "  ", quantity: 1 })).toThrow();
  });
  it("rejects a negative quantity", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: -1 })).toThrow();
  });
  it("rejects a non-integer quantity", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: 1.5 })).toThrow();
  });
  it("rejects a negative reorderLevel", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: 0, reorderLevel: -1 })).toThrow();
  });
  it("rejects a non-integer reorderLevel", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: 0, reorderLevel: 1.5 })).toThrow();
  });
  it("defaults unit, reorderLevel and notes", () => {
    const parsed = inventoryFormSchema.parse({ name: "A", quantity: 0 });
    expect(parsed.unit).toBe("");
    expect(parsed.reorderLevel).toBe(0);
    expect(parsed.notes).toBe("");
  });
});

describe("isLowStock", () => {
  it("is true when quantity is at or below the reorder level", () => {
    expect(isLowStock({ quantity: 3, reorderLevel: 3 })).toBe(true);
    expect(isLowStock({ quantity: 1, reorderLevel: 3 })).toBe(true);
  });
  it("is false when quantity is above the reorder level", () => {
    expect(isLowStock({ quantity: 4, reorderLevel: 3 })).toBe(false);
  });
  it("treats zero stock with a zero reorder level as low", () => {
    expect(isLowStock({ quantity: 0, reorderLevel: 0 })).toBe(true);
  });
});
