import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";
import { LeaveOverlapError } from "./staffRepo";

const TZ = "Asia/Kolkata";
const X = dateInputToZonedMs("2026-02-25", TZ);

const existingLeave = {
  id: "l1",
  staffId: "s1",
  staffName: "Ravi",
  from: dateInputToZonedMs("2026-03-10", TZ),
  to: dateInputToZonedMs("2026-03-11", TZ),
  halfDay: false,
  type: "Sick",
  note: "flu",
  createdAt: 1,
};

const saveAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("./useStaff", () => ({
  useStaffMember: () => ({ data: { id: "s1", name: "Ravi" } }),
  useStaffLeaves: () => ({ data: [existingLeave] }),
  useSaveLeave: () => ({ mutateAsync: saveAsync, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import LeaveFormPage from "./LeaveFormPage";

const renderPage = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/:clinicSlug/staff/:id/leaves/new"
          element={<LeaveFormPage />}
        />
        <Route
          path="/:clinicSlug/staff/:id/leaves/:leaveId/edit"
          element={<LeaveFormPage />}
        />
        <Route path="/:clinicSlug/staff/:id" element={<p>detail route</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  saveAsync.mockReset();
  saveAsync.mockResolvedValue(undefined);
  showToast.mockReset();
});

test("half day is disabled unless From equals To", async () => {
  const user = userEvent.setup();
  renderPage("/c1/staff/s1/leaves/new");
  await user.type(screen.getByLabelText(/^from/i), "2026-02-25");
  await user.type(screen.getByLabelText(/^to/i), "2026-02-26");
  expect(screen.getByLabelText(/half day/i)).toBeDisabled();
});

test("submits a single-day half-day unpaid leave", async () => {
  const user = userEvent.setup();
  renderPage("/c1/staff/s1/leaves/new");
  await user.type(screen.getByLabelText(/^from/i), "2026-02-25");
  await user.type(screen.getByLabelText(/^to/i), "2026-02-25");
  await user.click(screen.getByLabelText(/half day/i));
  await user.click(screen.getByLabelText(/^type/i));
  await user.click(await screen.findByRole("option", { name: "Unpaid" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(saveAsync).toHaveBeenCalledWith({
      values: {
        staffId: "s1",
        staffName: "Ravi",
        from: X,
        to: X,
        halfDay: true,
        type: "Unpaid",
        note: "",
      },
      previous: undefined,
    }),
  );
  expect(showToast).toHaveBeenCalledWith("Leave saved", "success");
  expect(await screen.findByText("detail route")).toBeInTheDocument();
});

test("editing passes the loaded leave as previous", async () => {
  const user = userEvent.setup();
  renderPage("/c1/staff/s1/leaves/l1/edit");
  await waitFor(() =>
    expect(screen.getByLabelText(/^from/i)).toHaveValue("2026-03-10"),
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(saveAsync).toHaveBeenCalled());
  expect(saveAsync.mock.calls[0][0].previous).toBe(existingLeave);
  expect(saveAsync.mock.calls[0][0].values.type).toBe("Sick");
});

test("shows an overlap error on the From field", async () => {
  saveAsync.mockRejectedValue(new LeaveOverlapError());
  const user = userEvent.setup();
  renderPage("/c1/staff/s1/leaves/new");
  await user.type(screen.getByLabelText(/^from/i), "2026-03-10");
  await user.type(screen.getByLabelText(/^to/i), "2026-03-10");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(
    await screen.findByText("This overlaps another leave"),
  ).toBeInTheDocument();
  expect(showToast).not.toHaveBeenCalled();
});
