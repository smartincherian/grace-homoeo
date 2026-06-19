import type { MedicineForm } from "../inventory/inventorySchema";

export type LiquidMode = "drops" | "fixed";

/**
 * Every input a dispense line might need, across all forms. A line only uses the
 * fields relevant to its item's form; the rest carry harmless defaults.
 */
export interface DispenseInputs {
  // pieces
  timesPerDay: number;
  pillsPerDose: number;
  days: number;
  // liquid (drops mode)
  dropsPerDose: number;
  dropsPerMl: number;
  // liquid (fixed mode)
  ml: number;
  // packaging / flat
  quantity: number;
  // which liquid dosing model to use
  liquidMode: LiquidMode;
}

export const DISPENSE_DEFAULTS: DispenseInputs = {
  timesPerDay: 4,
  pillsPerDose: 4,
  days: 14,
  dropsPerDose: 2,
  dropsPerMl: 20,
  ml: 30,
  quantity: 1,
  liquidMode: "drops",
};

export const DEFAULT_FEE = 150;

/** Amount dispensed, expressed in the form's base unit (pills / ml / bottles / units). */
export function baseQuantity(form: MedicineForm, i: DispenseInputs): number {
  switch (form) {
    case "pieces":
      return i.timesPerDay * i.pillsPerDose * i.days;
    case "liquid":
      if (i.liquidMode === "fixed") return i.ml;
      return i.dropsPerMl > 0
        ? (i.dropsPerDose * i.timesPerDay * i.days) / i.dropsPerMl
        : 0;
    case "packaging":
    case "flat":
      return i.quantity;
  }
}

/** Cost of a single dispense line = base quantity × per-unit cost. */
export function lineCost(
  form: MedicineForm,
  unitCost: number,
  i: DispenseInputs,
): number {
  return baseQuantity(form, i) * unitCost;
}
