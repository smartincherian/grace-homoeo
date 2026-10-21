import { describe, expect, it } from "vitest";
import {
  categoriesFor,
  categoryInfo,
  orderFormSchema,
  orderItemLabel,
  suggestionsFor,
  type OrderItem,
} from "./orderSchema";

const item = (o: Partial<OrderItem>): OrderItem => ({
  id: "x",
  category: "medicine",
  name: "",
  nameLower: "",
  variant: "",
  quantity: "",
  ordered: false,
  createdAt: 1,
  ...o,
});

describe("categoriesFor", () => {
  const keys = (t: "homoeo" | "general") => categoriesFor(t).map((c) => c.key);

  it("keeps the homoeo list as it was", () => {
    expect(keys("homoeo")).toEqual([
      "medicine",
      "biochemic",
      "globules",
      "bottles",
      "butterPaper",
      "blankPowder",
      "blankTablet",
      "syrups",
    ]);
  });

  it("gives general clinics their own list", () => {
    expect(keys("general")).toEqual([
      "generalMedicine",
      "syrups",
      "injections",
      "syringes",
      "dressings",
      "gloves",
    ]);
    expect(categoryInfo("generalMedicine")).toMatchObject({
      label: "Medicines",
      needsName: true,
      variant: { label: "Strength", options: ["250 mg", "500 mg", "650 mg"] },
    });
    expect(categoryInfo("syringes")).toMatchObject({
      needsName: false,
      variant: { label: "Size", options: ["2 ml", "5 ml", "10 ml"] },
    });
    expect(categoryInfo("injections")).toMatchObject({ needsName: true });
    expect(categoryInfo("dressings")).toMatchObject({ needsName: false });
    expect(categoryInfo("gloves")).toMatchObject({ needsName: false });
  });

  it("still parses items of every category", () => {
    expect(
      orderFormSchema.safeParse({ category: "biochemic", name: "Ferrum" })
        .success,
    ).toBe(true);
    expect(orderFormSchema.safeParse({ category: "gloves" }).success).toBe(
      true,
    );
  });
});

describe("orderFormSchema", () => {
  it("trims fields and defaults the optional ones", () => {
    const parsed = orderFormSchema.parse({
      category: "medicine",
      name: "  Arnica ",
    });
    expect(parsed).toEqual({
      category: "medicine",
      name: "Arnica",
      variant: "",
      quantity: "",
    });
  });
  it("requires a name for medicines", () => {
    expect(() =>
      orderFormSchema.parse({ category: "medicine", name: " " }),
    ).toThrow("Name is required");
  });
  it("allows supplies without a name", () => {
    const parsed = orderFormSchema.parse({
      category: "bottles",
      variant: "1 dram",
    });
    expect(parsed.name).toBe("");
  });
  it("rejects an unknown category", () => {
    expect(() =>
      orderFormSchema.parse({ category: "toys", name: "A" }),
    ).toThrow();
  });
});

describe("orderItemLabel", () => {
  it("joins name and potency", () => {
    expect(
      orderItemLabel({ category: "medicine", name: "Arnica", variant: "200" }),
    ).toBe("Arnica 200");
  });
  it("falls back to the category label when there is no name", () => {
    expect(
      orderItemLabel({ category: "bottles", name: "", variant: "2 dram" }),
    ).toBe("Bottles 2 dram");
    expect(
      orderItemLabel({ category: "butterPaper", name: "", variant: "" }),
    ).toBe("Butter paper");
  });
});

describe("suggestionsFor", () => {
  const items = [
    item({ name: "Sulphur" }),
    item({ name: "arnica", variant: "1M" }),
    item({ name: "Arnica", variant: "6C" }),
    item({ category: "syrups", name: "Alfalfa tonic" }),
  ];
  it("lists distinct names entered before in that category, A–Z", () => {
    expect(suggestionsFor(items, "medicine", "name")).toEqual([
      "arnica",
      "Sulphur",
    ]);
  });
  it("offers built-in names first, then entered ones", () => {
    expect(suggestionsFor(items, "syrups", "name")).toEqual([
      "Findrops",
      "Alfalfa tonic",
    ]);
  });
  it("offers built-in potencies first, then entered ones", () => {
    expect(suggestionsFor(items, "medicine", "variant")).toEqual([
      "Q",
      "6",
      "30",
      "200",
      "1M",
      "10M",
      "50M",
      "CM",
      "6C",
    ]);
  });
});
