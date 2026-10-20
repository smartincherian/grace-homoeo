import { describe, expect, it } from "vitest";
import {
  BRAND_PRESETS,
  brandCssVars,
  contrastRatio,
  derivePalette,
  ensureContrast,
} from "./brand";
import { buildTheme } from "./theme";

const lum = (hex: string) => contrastRatio(hex, "#000000");

describe("contrastRatio", () => {
  it("is 21 for white on black and 1 for identical colours", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});

describe("ensureContrast", () => {
  it("darkens colours that fail against white", () => {
    expect(contrastRatio(ensureContrast("#ffff00"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("leaves passing colours unchanged", () => {
    expect(ensureContrast("#150e56")).toBe("#150e56");
  });
  it("passes every preset", () => {
    for (const p of BRAND_PRESETS) {
      expect(contrastRatio(ensureContrast(p.hex), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("has 8 presets", () => {
    expect(BRAND_PRESETS).toHaveLength(8);
  });
});

describe("derivePalette", () => {
  const p = derivePalette("#2f6bff");
  it("orders the tints lighter", () => {
    expect(lum(p.s50)).toBeGreaterThan(lum(p.s100));
    expect(lum(p.s100)).toBeGreaterThan(lum(p.s200));
  });
  it("makes hover and s700 darker than main", () => {
    expect(lum(p.hover)).toBeLessThan(lum(p.main));
    expect(lum(p.s700)).toBeLessThan(lum(p.main));
  });
  it("formats rgb", () => {
    expect(p.rgb).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
  });
});

describe("brandCssVars", () => {
  it("returns exactly the 8 keys", () => {
    expect(Object.keys(brandCssVars(derivePalette("#2f6bff"))).sort()).toEqual(
      [
        "--brand",
        "--brand-100",
        "--brand-200",
        "--brand-300",
        "--brand-50",
        "--brand-700",
        "--brand-hover",
        "--brand-rgb",
      ].sort(),
    );
  });
});

describe("buildTheme", () => {
  it("builds primary from the contrast-corrected hex", () => {
    expect(buildTheme("#0f766e").palette.primary.main).toBe(ensureContrast("#0f766e"));
  });
});
