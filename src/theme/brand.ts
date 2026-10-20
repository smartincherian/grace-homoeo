export const DEFAULT_BRAND = "#2f6bff";

export const BRAND_PRESETS: readonly { label: string; hex: string }[] = [
  { label: "Blue", hex: "#2f6bff" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Teal", hex: "#0f766e" },
  { label: "Green", hex: "#15803d" },
  { label: "Maroon", hex: "#9f1239" },
  { label: "Purple", hex: "#7e22ce" },
  { label: "Orange", hex: "#c2410c" },
  { label: "Slate", hex: "#334155" },
];

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = ([r, g, b]: RGB): string =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const mix = (hex: string, target: RGB, amount: number): string => {
  const c = toRgb(hex);
  return toHex(c.map((v, i) => v + (target[i] - v) * amount) as RGB);
};

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Returns hex (lowercased) if it reads on white at 4.5:1, else darkens it. */
export function ensureContrast(hex: string): string {
  let out = hex.toLowerCase();
  for (let step = 1; contrastRatio(out, "#ffffff") < 4.5 && step <= 20; step++) {
    out = mix(hex.toLowerCase(), BLACK, step * 0.05);
  }
  return out;
}

export interface BrandPalette {
  main: string;
  hover: string;
  s50: string;
  s100: string;
  s200: string;
  s300: string;
  s700: string;
  rgb: string;
}

export function derivePalette(hex: string): BrandPalette {
  const main = ensureContrast(hex);
  return {
    main,
    hover: mix(main, BLACK, 0.12),
    s700: mix(main, BLACK, 0.35),
    s50: mix(main, WHITE, 0.95),
    s100: mix(main, WHITE, 0.88),
    s200: mix(main, WHITE, 0.75),
    s300: mix(main, WHITE, 0.25),
    rgb: toRgb(main).join(", "),
  };
}

export function brandCssVars(p: BrandPalette): Record<string, string> {
  return {
    "--brand": p.main,
    "--brand-hover": p.hover,
    "--brand-50": p.s50,
    "--brand-100": p.s100,
    "--brand-200": p.s200,
    "--brand-300": p.s300,
    "--brand-700": p.s700,
    "--brand-rgb": p.rgb,
  };
}
