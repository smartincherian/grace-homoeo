import { z } from "zod";

/**
 * Categories on the "Items need to order now" list, in display order.
 * `variant` names the extra detail a category is ordered by (potency, size),
 * with common values offered in the dropdown; `needsName` is false for
 * supplies where the category itself is the item (e.g. butter paper);
 * `names` are common names offered first in the Name dropdown.
 */
export const ORDER_CATEGORIES = [
  {
    key: "medicine",
    label: "Medicines",
    needsName: true,
    variant: {
      label: "Potency",
      options: ["Q", "6", "30", "200", "1M", "10M", "50M", "CM"],
    },
  },
  {
    key: "biochemic",
    label: "Biochemic remedies",
    needsName: true,
    variant: { label: "Potency", options: ["3x", "6x", "12x", "30x"] },
  },
  { key: "globules", label: "Globules", needsName: false, variant: null },
  {
    key: "bottles",
    label: "Bottles",
    needsName: false,
    variant: { label: "Size", options: ["1 dram", "2 dram"] },
  },
  { key: "butterPaper", label: "Butter paper", needsName: false, variant: null },
  { key: "blankPowder", label: "Blank powder", needsName: false, variant: null },
  { key: "blankTablet", label: "Blank tablet", needsName: false, variant: null },
  {
    key: "syrups",
    label: "Syrups",
    needsName: true,
    names: ["Findrops"],
    variant: null,
  },
] as const;

export type OrderCategory = (typeof ORDER_CATEGORIES)[number]["key"];
export type OrderCategoryInfo = (typeof ORDER_CATEGORIES)[number];

const CATEGORY_KEYS = ORDER_CATEGORIES.map((c) => c.key) as [
  OrderCategory,
  ...OrderCategory[],
];

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
