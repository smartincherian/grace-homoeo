import { describe, expect, it } from "vitest";
import {
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
