import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const expenses = [
  { id: "e1", date: 1718000000000, category: "Rent", amount: 5000, note: "" },
];
const deleteMutate = vi.fn();
const useSalariesMock = vi.fn();
let isOwnerMock = true;
vi.mock("../auth/AuthGuard", () => ({
  useMembership: () =>
    isOwnerMock
      ? { superadmin: false, clinicId: "c1", owner: true }
      : { superadmin: false, clinicId: "c1", owner: false },
}));
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
  useSalaries: (s: number, e: number, enabled: boolean) => {
    useSalariesMock(s, e, enabled);
    return enabled
      ? {
          data: { total: 3000, count: 2 },
          status: "success",
          isPending: false,
          isError: false,
        }
      : {
          data: undefined,
          status: "pending",
          isPending: true,
          isError: false,
          fetchStatus: "idle",
        };
  },
  useDeleteExpense: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import FundsPage from "./FundsPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/c1/funds"]}>
      <Routes>
        <Route path="/:clinicSlug/*" element={<FundsPage />} />
      </Routes>
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

test("owner sees the Salaries line counted in expenses", () => {
  isOwnerMock = true;
  renderPage();
  expect(screen.getByText("Salaries")).toBeInTheDocument();
  expect(screen.getByText("2 payments · from Payroll")).toBeInTheDocument();
  expect(screen.getByText("₹3,000")).toBeInTheDocument();
  expect(screen.getByText("₹8,000")).toBeInTheDocument();
  expect(useSalariesMock).toHaveBeenLastCalledWith(
    expect.any(Number),
    expect.any(Number),
    true,
  );
});

test("member never enables the salaries query and sees no Salaries", () => {
  isOwnerMock = false;
  useSalariesMock.mockClear();
  renderPage();
  expect(useSalariesMock).toHaveBeenCalled();
  for (const call of useSalariesMock.mock.calls) expect(call[2]).toBe(false);
  expect(screen.queryByText("Salaries")).not.toBeInTheDocument();
  expect(screen.getAllByText("₹5,000").length).toBeGreaterThan(0);
  expect(screen.queryByText("₹8,000")).not.toBeInTheDocument();
});
