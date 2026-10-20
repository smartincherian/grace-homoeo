import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";

const createAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("./useStaff", () => ({
  useCreateStaff: () => ({ mutateAsync: createAsync, isPending: false }),
  useUpdateStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStaffMember: () => ({ data: undefined }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import StaffFormPage from "./StaffFormPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/c1/staff/new"]}>
      <Routes>
        <Route path="/:clinicSlug/staff/new" element={<StaffFormPage />} />
        <Route path="/:clinicSlug/staff/:id" element={<p>detail route</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  createAsync.mockReset();
  createAsync.mockResolvedValue("new1");
  showToast.mockReset();
});

test("submits clinic-zone dates and goes to the staff page", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.type(screen.getByLabelText(/^name/i), "Ravi");
  await user.type(screen.getByLabelText(/joined on/i), "2026-02-01");
  await user.clear(screen.getByLabelText(/monthly salary/i));
  await user.type(screen.getByLabelText(/monthly salary/i), "12000");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(createAsync).toHaveBeenCalledWith({
      name: "Ravi",
      joinedOn: dateInputToZonedMs("2026-02-01", "Asia/Kolkata"),
      leftOn: null,
      monthlySalary: 12000,
      phone: "",
      designation: "",
    }),
  );
  expect(showToast).toHaveBeenCalledWith("Staff saved", "success");
  expect(await screen.findByText("detail route")).toBeInTheDocument();
});

test("rejects a leaving date before the joining date", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.type(screen.getByLabelText(/^name/i), "Ravi");
  await user.type(screen.getByLabelText(/joined on/i), "2026-02-01");
  await user.type(screen.getByLabelText(/left on/i), "2026-01-01");
  await user.type(screen.getByLabelText(/monthly salary/i), "12000");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("Leaving date can't be before joining date"),
  ).toBeInTheDocument();
  expect(createAsync).not.toHaveBeenCalled();
});

test("requires a monthly salary instead of saving zero", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.type(screen.getByLabelText(/^name/i), "Ravi");
  await user.type(screen.getByLabelText(/joined on/i), "2026-02-01");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("Monthly salary is required"),
  ).toBeInTheDocument();
  expect(createAsync).not.toHaveBeenCalled();
});
