import { vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrderItem } from "./orderSchema";

const row = (o: Partial<OrderItem>): OrderItem => ({
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

const data = [
  row({ id: "o1", name: "Arnica", variant: "200", quantity: "2" }),
  row({ id: "o2", category: "bottles", variant: "1 dram" }),
  row({ id: "o3", name: "Sulphur", ordered: true }),
];
const clinic = vi.hoisted(() => ({ type: "homoeo" as "homoeo" | "general" }));
vi.mock("../../lib/useClinicFeatures", async () => {
  const { clinicFeatures } = await import("../../lib/clinicType");
  return { useClinicFeatures: () => clinicFeatures(clinic.type) };
});
const createMutate = vi.fn();
const orderedMutate = vi.fn();
vi.mock("./useOrders", () => ({
  useOrderItems: () => ({ status: "success", data }),
  useCreateOrderItem: () => ({ mutate: createMutate, isPending: false }),
  useMarkOrdered: () => ({ mutate: orderedMutate, isPending: false }),
  useDeleteOrderItem: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import OrderListSection from "./OrderListSection";

beforeEach(() => {
  clinic.type = "homoeo";
  createMutate.mockReset();
  orderedMutate.mockReset();
});

test("shows the heading and pending items grouped by category", () => {
  render(<OrderListSection />);
  expect(
    screen.getByRole("heading", { name: "Items need to order now" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Medicines" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Arnica 200")).toBeInTheDocument();
  expect(screen.getByText("× 2")).toBeInTheDocument();
  expect(screen.getByText("Bottles 1 dram")).toBeInTheDocument();
  // Already ordered entries are hidden from the list.
  expect(screen.queryByText("Sulphur")).not.toBeInTheDocument();
});

test("offers names entered before, including already ordered ones", async () => {
  const user = userEvent.setup();
  render(<OrderListSection />);
  await user.click(screen.getByRole("combobox", { name: "Name" }));
  const list = screen.getByRole("listbox");
  expect(within(list).getByText("Arnica")).toBeInTheDocument();
  expect(within(list).getByText("Sulphur")).toBeInTheDocument();
});

test("adds a medicine with its potency", async () => {
  const user = userEvent.setup();
  render(<OrderListSection />);
  await user.type(screen.getByRole("combobox", { name: "Name" }), "Nux vomica");
  await user.type(screen.getByRole("combobox", { name: "Potency" }), "1M");
  await user.click(screen.getByRole("button", { name: "Add" }));
  expect(createMutate).toHaveBeenCalledWith(
    { category: "medicine", name: "Nux vomica", variant: "1M", quantity: "" },
    expect.anything(),
  );
});

test("requires a name for medicines", async () => {
  const user = userEvent.setup();
  render(<OrderListSection />);
  await user.click(screen.getByRole("button", { name: "Add" }));
  expect(screen.getByText("Name is required")).toBeInTheDocument();
  expect(createMutate).not.toHaveBeenCalled();
});

test("ticking an item marks it ordered", async () => {
  const user = userEvent.setup();
  render(<OrderListSection />);
  await user.click(
    screen.getByRole("checkbox", { name: "Mark Arnica 200 as ordered" }),
  );
  expect(orderedMutate).toHaveBeenCalledWith("o1", expect.anything());
});

test("a general clinic picks from its own categories but still lists older items", async () => {
  clinic.type = "general";
  data.push(row({ id: "o4", category: "biochemic", name: "Ferrum phos" }));
  render(<OrderListSection />);
  expect(
    screen.getByRole("heading", { name: "Biochemic remedies" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Ferrum phos")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("combobox", { name: "Category" }));
  const options = screen.getAllByRole("option").map((o) => o.textContent);
  expect(options).toEqual([
    "Medicines",
    "Syrups",
    "Injections",
    "Syringes",
    "Dressings",
    "Gloves",
  ]);
  data.pop();
});
