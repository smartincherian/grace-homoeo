import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";

const TZ = "Asia/Kolkata";
const day = (s: string) => dateInputToZonedMs(s, TZ);
const year = new Date().getFullYear();

const leave = {
  id: "l1",
  staffId: "s1",
  staffName: "Ravi",
  from: day(`${year}-03-10`),
  to: day(`${year}-03-11`),
  halfDay: false,
  type: "Casual",
  note: "wedding",
  createdAt: 1,
};
const payment = {
  id: "s1_2026-02",
  staffId: "s1",
  staffName: "Ravi",
  month: "2026-02",
  base: 12000,
  paidDays: 28,
  unpaidDays: 0,
  deduction: 0,
  adjustment: 0,
  adjustmentNote: "",
  net: 12000,
  paidOn: day("2026-03-01"),
  paymentMode: "UPI",
  needsReview: true,
};

const deleteAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("./useStaff", () => ({
  useStaffMember: () => ({
    data: {
      id: "s1",
      name: "Ravi",
      designation: "Nurse",
      monthlySalary: 12000,
      joinedOn: day("2025-01-01"),
      leftOn: null,
    },
    status: "success",
  }),
  useStaffLeaves: () => ({ data: [leave], status: "success" }),
  useStaffPayments: () => ({ data: [payment], status: "success" }),
  useDeleteLeave: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import StaffDetailPage from "./StaffDetailPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/c1/staff/s1"]}>
      <Routes>
        <Route path="/:clinicSlug/staff/:id" element={<StaffDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  deleteAsync.mockReset();
  deleteAsync.mockResolvedValue(undefined);
  showToast.mockReset();
});

test("shows yearly leave totals", () => {
  renderPage();
  expect(screen.getByText(/Casual 2/)).toBeInTheDocument();
});

test("flags a payment that needs review", () => {
  renderPage();
  expect(screen.getByText("Needs review")).toBeInTheDocument();
  expect(screen.getByText("Feb 2026 · ₹12,000")).toBeInTheDocument();
});

test("deletes a leave after confirming", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByLabelText(/actions for/i));
  await user.click(await screen.findByText("Delete"));
  await user.click(await screen.findByRole("button", { name: "Delete" }));
  await waitFor(() => expect(deleteAsync).toHaveBeenCalledWith(leave));
  expect(showToast).toHaveBeenCalledWith("Leave deleted", "success");
});
