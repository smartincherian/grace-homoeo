import { vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";

const TZ = "Asia/Kolkata";
const day = (s: string) => dateInputToZonedMs(s, TZ);

const staff = [
  {
    id: "r1",
    name: "Ravi",
    monthlySalary: 28000,
    joinedOn: day("2025-01-01"),
    leftOn: null,
  },
  {
    id: "m1",
    name: "Mini",
    monthlySalary: 20000,
    joinedOn: day("2026-03-01"),
    leftOn: null,
  },
];
const unpaidLeave = {
  id: "l1",
  staffId: "r1",
  staffName: "Ravi",
  from: day("2026-02-03"),
  to: day("2026-02-04"),
  halfDay: false,
  type: "Unpaid",
  note: "",
  createdAt: 1,
};
const payment = {
  id: "r1_2026-02",
  staffId: "r1",
  staffName: "Ravi",
  month: "2026-02",
  base: 28000,
  paidDays: 28,
  unpaidDays: 0,
  deduction: 0,
  adjustment: 0,
  adjustmentNote: "",
  net: 28000,
  paidOn: day("2026-02-28"),
  paymentMode: "Cash",
  needsReview: true,
};

const state = vi.hoisted(() => ({ payments: [] as unknown[] }));
const markPaidAsync = vi.hoisted(() => vi.fn());
const deleteAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("./useStaff", () => ({
  useStaffList: () => ({ data: staff, status: "success" }),
  useMonthLeaves: () => ({ data: [unpaidLeave], status: "success" }),
  useMonthPayments: () => ({ data: state.payments, status: "success" }),
  useMarkPaid: () => ({ mutateAsync: markPaidAsync, isPending: false }),
  useDeletePayment: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import PayrollPage from "./PayrollPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/c1/staff/payroll"]}>
      <Routes>
        <Route path="/:clinicSlug/staff/payroll" element={<PayrollPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: day("2026-02-20") });
  state.payments = [];
  markPaidAsync.mockReset().mockResolvedValue(undefined);
  deleteAsync.mockReset().mockResolvedValue(undefined);
  showToast.mockReset();
});

test("lists only employed staff with computed net", () => {
  renderPage();
  expect(screen.getByText("Ravi")).toBeInTheDocument();
  expect(screen.queryByText("Mini")).not.toBeInTheDocument();
  expect(screen.getByText(/Net ₹26,000/)).toBeInTheDocument();
  expect(screen.getByText(/Total net ₹26,000/)).toBeInTheDocument();
});

test("marks paid with adjustment, date and mode", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Mark paid" }));
  const dlg = await screen.findByRole("dialog");
  await user.type(within(dlg).getByLabelText(/Adjustment \(/), "500");
  expect(within(dlg).getByText(/Net ₹26,500/)).toBeInTheDocument();
  const paidOn = within(dlg).getByLabelText("Paid on");
  await user.clear(paidOn);
  await user.type(paidOn, "2026-02-28");
  await user.click(within(dlg).getByLabelText("Mode"));
  await user.click(await screen.findByRole("option", { name: "UPI" }));
  await user.click(within(dlg).getByRole("button", { name: "Mark paid" }));
  await waitFor(() =>
    expect(markPaidAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: "r1",
        month: "2026-02",
        base: 28000,
        unpaidDays: 2,
        deduction: 2000,
        adjustment: 500,
        net: 26500,
        paymentMode: "UPI",
        paidOn: dateInputToZonedMs("2026-02-28", TZ),
      }),
    ),
  );
  expect(showToast).toHaveBeenCalledWith("Salary marked paid", "success");
});

test("paid row needing review can be paid again or undone", async () => {
  state.payments = [payment];
  const user = userEvent.setup();
  renderPage();
  expect(screen.getByText("Leave changed — review")).toBeInTheDocument();
  expect(screen.getByText(/Paid ₹28,000 on/)).toBeInTheDocument();
  expect(screen.getByText("Now ₹26,000")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pay again" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo payment" }));
  const dlg = await screen.findByRole("dialog");
  await user.click(within(dlg).getByRole("button", { name: "Undo payment" }));
  await waitFor(() =>
    expect(deleteAsync).toHaveBeenCalledWith({
      staffId: "r1",
      month: "2026-02",
    }),
  );
  expect(showToast).toHaveBeenCalledWith("Payment undone", "success");
});

test("no Now chip when the payment needs no review", () => {
  state.payments = [{ ...payment, needsReview: false }];
  renderPage();
  expect(screen.queryByText(/^Now ₹/)).not.toBeInTheDocument();
});

test("Pay again prefills the stored payment and keeps its values", async () => {
  state.payments = [
    {
      ...payment,
      adjustment: 500,
      adjustmentNote: "Diwali bonus",
      net: 26500,
      paidOn: day("2026-02-25"),
      paymentMode: "UPI",
    },
  ];
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Pay again" }));
  const dlg = await screen.findByRole("dialog");
  expect(within(dlg).getByLabelText(/Adjustment \(/)).toHaveValue(500);
  expect(within(dlg).getByLabelText("Adjustment note")).toHaveValue(
    "Diwali bonus",
  );
  expect(within(dlg).getByLabelText("Paid on")).toHaveValue("2026-02-25");
  expect(within(dlg).getByText("UPI")).toBeInTheDocument();
  expect(within(dlg).queryByRole("button", { name: "Mark paid" })).toBeNull();
  await user.click(within(dlg).getByRole("button", { name: "Update payment" }));
  await waitFor(() =>
    expect(markPaidAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        base: 28000,
        deduction: 2000,
        adjustment: 500,
        adjustmentNote: "Diwali bonus",
        net: 26500,
        paymentMode: "UPI",
        paidOn: day("2026-02-25"),
      }),
    ),
  );
});

test("stored adjustment is honoured: no Now chip, total uses paid net", () => {
  state.payments = [{ ...payment, adjustment: 500, net: 26500 }];
  renderPage();
  expect(screen.queryByText(/^Now ₹/)).not.toBeInTheDocument();
  expect(screen.getByText(/Total net ₹26,500/)).toBeInTheDocument();
});

test("rejects a fractional adjustment", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Mark paid" }));
  const dlg = await screen.findByRole("dialog");
  await user.type(within(dlg).getByLabelText(/Adjustment \(/), "100.5");
  expect(within(dlg).getByText("Whole rupees only")).toBeInTheDocument();
  expect(within(dlg).getByRole("button", { name: "Mark paid" })).toBeDisabled();
});

afterEach(() => vi.useRealTimers());
