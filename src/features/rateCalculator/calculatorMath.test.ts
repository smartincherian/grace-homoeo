import { describe, expect, it } from "vitest";
import {
  baseQuantity,
  lineCost,
  DISPENSE_DEFAULTS,
  type DispenseInputs,
} from "./calculatorMath";

const inputs = (over: Partial<DispenseInputs> = {}): DispenseInputs => ({
  ...DISPENSE_DEFAULTS,
  ...over,
});

describe("baseQuantity", () => {
  it("pieces: times/day × pills/dose × days", () => {
    expect(
      baseQuantity("pieces", inputs({ timesPerDay: 4, pillsPerDose: 4, days: 14 })),
    ).toBe(224);
  });

  it("liquid drops: total drops ÷ drops-per-ml", () => {
    // 2 drops × 4/day × 14 days = 112 drops; ÷ 20 = 5.6 ml
    expect(
      baseQuantity(
        "liquid",
        inputs({
          liquidMode: "drops",
          dropsPerDose: 2,
          timesPerDay: 4,
          days: 14,
          dropsPerMl: 20,
        }),
      ),
    ).toBeCloseTo(5.6);
  });

  it("liquid drops: returns 0 when drops-per-ml is zero", () => {
    expect(
      baseQuantity("liquid", inputs({ liquidMode: "drops", dropsPerMl: 0 })),
    ).toBe(0);
  });

  it("liquid fixed: just the ml dispensed", () => {
    expect(
      baseQuantity("liquid", inputs({ liquidMode: "fixed", ml: 30 })),
    ).toBe(30);
  });

  it("packaging / flat: the quantity", () => {
    expect(baseQuantity("packaging", inputs({ quantity: 1 }))).toBe(1);
    expect(baseQuantity("flat", inputs({ quantity: 3 }))).toBe(3);
  });
});

describe("lineCost", () => {
  it("multiplies base quantity by per-unit cost", () => {
    // 224 pills × ₹0.20/pill = ₹44.80
    expect(
      lineCost(
        "pieces",
        0.2,
        inputs({ timesPerDay: 4, pillsPerDose: 4, days: 14 }),
      ),
    ).toBeCloseTo(44.8);
  });

  it("costs a packaging bottle at its unit rate", () => {
    expect(lineCost("packaging", 3, inputs({ quantity: 1 }))).toBe(3);
  });
});
