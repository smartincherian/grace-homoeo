import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("./useFunds", () => ({
  useExpense: () => ({ data: undefined }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import ExpenseFormPage from "./ExpenseFormPage";

const HELPER =
  "Staff salaries marked paid in Payroll are added to Funds automatically — don't enter them here.";

test("picking category Salary shows the payroll helper", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/c1/funds/expenses/new"]}>
      <Routes>
        <Route path="/:clinicSlug/*" element={<ExpenseFormPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.queryByText(HELPER)).not.toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: /category/i }));
  await user.click(screen.getByRole("option", { name: "Salary" }));
  expect(screen.getByText(HELPER)).toBeInTheDocument();
});
