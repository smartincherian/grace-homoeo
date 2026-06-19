import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const expenses = [
  { id: "e1", date: 1718000000000, category: "Rent", amount: 5000, note: "" },
];
const deleteMutate = vi.fn();
vi.mock("./useFunds", () => ({
  useIncome: () => ({
    data: [],
    status: "success",
    isPending: false,
    isError: false,
  }),
  useExpenses: () => ({
    data: expenses,
    status: "success",
    isPending: false,
    isError: false,
  }),
  useDeleteExpense: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import FundsPage from "./FundsPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <FundsPage />
    </MemoryRouter>,
  );

test("shows a labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: "Add expense" })).toHaveTextContent(
    "Add expense",
  );
});

test("deletes an expense after confirmation", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: /actions for rent/i }));
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  expect(deleteMutate).toHaveBeenCalledWith("e1", expect.anything());
});
