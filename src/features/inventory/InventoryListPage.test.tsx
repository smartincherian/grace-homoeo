import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const data = [
  {
    id: "i1",
    name: "Arnica 30",
    nameLower: "arnica 30",
    quantity: 12,
    unit: "vials",
    reorderLevel: 3,
    notes: "",
    updatedAt: 1,
  },
];
const deleteMutate = vi.fn();
vi.mock("./useInventory", () => ({
  useInventory: () => ({ status: "success", data }),
  useSetQuantity: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteItem: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import InventoryListPage from "./InventoryListPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <InventoryListPage />
    </MemoryRouter>,
  );

test("shows a labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: "Add item" })).toHaveTextContent(
    "Add item",
  );
});

test("deletes an item after confirmation", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(
    screen.getByRole("button", { name: /actions for arnica 30/i }),
  );
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  expect(deleteMutate).toHaveBeenCalledWith("i1", expect.anything());
});
