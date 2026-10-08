import { describe, expect, it } from "vitest";
import {
  inventoryFormSchema,
  isLowStock,
  unitCostOf,
  isPriced,
  baseUnitLabel,
} from "./inventorySchema";

describe("inventoryFormSchema", () => {
  it("accepts a valid item and trims the name", () => {
    const parsed = inventoryFormSchema.parse({
      name: "  Arnica 30  ",
      quantity: 12,
      unit: "vials",
      reorderLevel: 3,
      notes: "shelf A",
    });
    expect(parsed.name).toBe("Arnica 30");
    expect(parsed.quantity).toBe(12);
  });
  it("rejects an empty name", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "  ", quantity: 1 }),
    ).toThrow();
  });
  it("rejects a negative quantity", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: -1 }),
    ).toThrow();
  });
  it("rejects a non-integer quantity", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 1.5 }),
    ).toThrow();
  });
  it("rejects a negative reorderLevel", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 0, reorderLevel: -1 }),
    ).toThrow();
  });
  it("rejects a non-integer reorderLevel", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 0, reorderLevel: 1.5 }),
    ).toThrow();
  });
  it("defaults unit, reorderLevel and notes", () => {
    const parsed = inventoryFormSchema.parse({ name: "A", quantity: 0 });
    expect(parsed.unit).toBe("");
    expect(parsed.reorderLevel).toBe(0);
    expect(parsed.notes).toBe("");
  });
  it("defaults pricing fields (flat, ₹0, lot 1)", () => {
    const parsed = inventoryFormSchema.parse({ name: "A", quantity: 0 });
    expect(parsed.form).toBe("flat");
    expect(parsed.purchaseCost).toBe(0);
    expect(parsed.lotSize).toBe(1);
  });
  it("accepts a known form and bulk cost", () => {
    const parsed = inventoryFormSchema.parse({
      name: "Ferrum Phos 6x",
      quantity: 1,
      form: "pieces",
      purchaseCost: 100,
      lotSize: 500,
    });
    expect(parsed.form).toBe("pieces");
    expect(parsed.purchaseCost).toBe(100);
    expect(parsed.lotSize).toBe(500);
  });
  it("rejects an unknown form", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 0, form: "powder" }),
    ).toThrow();
  });
  it("rejects a negative purchaseCost", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 0, purchaseCost: -1 }),
    ).toThrow();
  });
  it("rejects a non-positive lotSize", () => {
    expect(() =>
      inventoryFormSchema.parse({ name: "A", quantity: 0, lotSize: 0 }),
    ).toThrow();
  });
});

describe("unitCostOf", () => {
  it("divides purchase cost by lot size", () => {
    expect(unitCostOf({ purchaseCost: 100, lotSize: 500 })).toBe(0.2);
  });
  it("returns 0 when lot size is zero", () => {
    expect(unitCostOf({ purchaseCost: 100, lotSize: 0 })).toBe(0);
  });
});

describe("isPriced", () => {
  it("is true only with positive cost and lot size", () => {
    expect(isPriced({ purchaseCost: 100, lotSize: 500 })).toBe(true);
    expect(isPriced({ purchaseCost: 0, lotSize: 500 })).toBe(false);
    expect(isPriced({ purchaseCost: 100, lotSize: 0 })).toBe(false);
  });
});

describe("baseUnitLabel", () => {
  it("labels each form's base unit", () => {
    expect(baseUnitLabel("pieces")).toBe("pill");
    expect(baseUnitLabel("liquid")).toBe("ml");
    expect(baseUnitLabel("packaging")).toBe("bottle");
    expect(baseUnitLabel("flat")).toBe("unit");
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
