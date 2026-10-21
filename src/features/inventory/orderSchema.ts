import { z } from "zod";
import type { ClinicType } from "../../lib/clinicType";

/**
 * Categories on the "Items need to order now" list, in display order.
 * `variant` names the extra detail a category is ordered by (potency, size),
 * with common values offered in the dropdown; `needsName` is false for
 * supplies where the category itself is the item (e.g. butter paper);
 * `names` are common names offered first in the Name dropdown; `types` are
 * the clinic types that pick from it (stored items always show).
 */
const HOMOEO = ["homoeo"] as const;
const GENERAL = ["general"] as const;
const BOTH = ["homoeo", "general"] as const;

export const ORDER_CATEGORIES = [
  {
    key: "medicine",
    label: "Medicines",
    types: HOMOEO,
    needsName: true,
    variant: {
      label: "Potency",
      options: ["Q", "6", "30", "200", "1M", "10M", "50M", "CM"],
    },
  },
  {
    key: "biochemic",
    label: "Biochemic remedies",
    types: HOMOEO,
    needsName: true,
    variant: { label: "Potency", options: ["3x", "6x", "12x", "30x"] },
  },
  {
    key: "globules",
    label: "Globules",
    types: HOMOEO,
    needsName: false,
    variant: null,
  },
  {
    key: "bottles",
    label: "Bottles",
    types: HOMOEO,
    needsName: false,
    variant: { label: "Size", options: ["1 dram", "2 dram"] },
  },
  {
    key: "butterPaper",
    label: "Butter paper",
    types: HOMOEO,
    needsName: false,
    variant: null,
  },
  {
    key: "blankPowder",
    label: "Blank powder",
    types: HOMOEO,
    needsName: false,
    variant: null,
  },
  {
    key: "blankTablet",
    label: "Blank tablet",
    types: HOMOEO,
    needsName: false,
    variant: null,
  },
  {
    key: "generalMedicine",
    label: "Medicines",
    types: GENERAL,
    needsName: true,
    variant: { label: "Strength", options: ["250 mg", "500 mg", "650 mg"] },
  },
  {
    key: "syrups",
    label: "Syrups",
    types: BOTH,
    needsName: true,
    names: ["Findrops"],
    variant: null,
  },
  {
    key: "injections",
    label: "Injections",
    types: GENERAL,
    needsName: true,
    variant: null,
  },
  {
    key: "syringes",
    label: "Syringes",
    types: GENERAL,
    needsName: false,
    variant: { label: "Size", options: ["2 ml", "5 ml", "10 ml"] },
  },
  {
    key: "dressings",
    label: "Dressings",
    types: GENERAL,
    needsName: false,
    variant: null,
  },
  {
    key: "gloves",
    label: "Gloves",
    types: GENERAL,
    needsName: false,
    variant: null,
  },
] as const;

export type OrderCategory = (typeof ORDER_CATEGORIES)[number]["key"];
export type OrderCategoryInfo = (typeof ORDER_CATEGORIES)[number];

const CATEGORY_KEYS = ORDER_CATEGORIES.map((c) => c.key) as [
  OrderCategory,
  ...OrderCategory[],
];

/** The categories a clinic of this type adds to, in display order. */
export function categoriesFor(type: ClinicType): OrderCategoryInfo[] {
  return ORDER_CATEGORIES.filter((c) =>
    (c.types as readonly ClinicType[]).includes(type),
  );
}

export function categoryInfo(key: OrderCategory): OrderCategoryInfo {
  return ORDER_CATEGORIES.find((c) => c.key === key) ?? ORDER_CATEGORIES[0];
}

export const orderFormSchema = z
  .object({
    category: z.enum(CATEGORY_KEYS),
    name: z.string().trim().default(""),
    variant: z.string().trim().default(""),
    quantity: z.string().trim().default(""),
  })
  .superRefine((v, ctx) => {
    if (categoryInfo(v.category).needsName && !v.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Name is required",
      });
    }
  });

export type OrderFormValues = z.infer<typeof orderFormSchema>;

export interface OrderItem extends OrderFormValues {
  id: string;
  nameLower: string;
  ordered: boolean;
  createdAt: number;
}

/** What the item reads as on the list, e.g. "Arnica 200" or "Bottles 1 dram". */
export function orderItemLabel(
  item: Pick<OrderItem, "category" | "name" | "variant">,
): string {
  const base = item.name || categoryInfo(item.category).label;
  return item.variant ? `${base} ${item.variant}` : base;
}

/**
 * Autofill choices for a category: every distinct value entered before
 * (any spelling, first one wins), plus the category's built-in names or
 * variant options, sorted for the dropdown.
 */
export function suggestionsFor(
  items: OrderItem[],
  category: OrderCategory,
  field: "name" | "variant",
): string[] {
  const seen = new Map<string, string>();
  const add = (v: string) => {
    const key = v.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, v.trim());
  };
  const info = categoryInfo(category);
  const builtInOptions =
    field === "name"
      ? "names" in info
        ? info.names
        : []
      : (info.variant?.options ?? []);
  builtInOptions.forEach(add);
  const builtIn = seen.size;
  items.filter((i) => i.category === category).forEach((i) => add(i[field]));
  const all = [...seen.values()];
  // Built-in options keep their natural order; entered values follow, A–Z.
  return [
    ...all.slice(0, builtIn),
    ...all.slice(builtIn).sort((a, b) => a.localeCompare(b)),
  ];
}
