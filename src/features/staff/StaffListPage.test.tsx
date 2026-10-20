import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";

const TZ = "Asia/Kolkata";
const base = { phone: "", nameLower: "", createdAt: 0 };
const staff = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock("./useStaff", () => ({
  useStaffList: () => ({ data: staff.value, status: "success" }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));

import StaffListPage from "./StaffListPage";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/c1/staff"]}>
      <Routes>
        <Route path="/:clinicSlug/staff" element={<StaffListPage />} />
      </Routes>
    </MemoryRouter>,
  );

test("shows a staff card and links to add and payroll", () => {
  staff.value = [
    {
      ...base,
      id: "s1",
      name: "Ravi",
      designation: "Assistant",
      monthlySalary: 12000,
      joinedOn: dateInputToZonedMs("2026-01-01", TZ),
      leftOn: null,
      active: true,
    },
  ];
  renderPage();
  expect(screen.getByText("Ravi")).toBeInTheDocument();
  expect(screen.getByText("Assistant · ₹12,000/month")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Add staff" })).toHaveAttribute(
    "href",
    "/c1/staff/new",
  );
  expect(screen.getByRole("link", { name: /payroll/i })).toHaveAttribute(
    "href",
    "/c1/staff/payroll",
  );
});

test("lists active staff first and labels Left vs Leaving by date", () => {
  const past = dateInputToZonedMs("2020-03-05", TZ);
  const future = dateInputToZonedMs("2099-03-05", TZ);
  const mk = (id: string, name: string, leftOn: number | null) => ({
    ...base,
    id,
    name,
    designation: "Nurse",
    monthlySalary: 1000,
    joinedOn: dateInputToZonedMs("2019-01-01", TZ),
    leftOn,
    active: leftOn === null,
  });
  staff.value = [mk("a", "Gone", past), mk("b", "Here", null), mk("c", "Soon", future)];
  renderPage();
  const names = screen.getAllByText(/^(Gone|Here|Soon)$/).map((e) => e.textContent);
  expect(names).toEqual(["Here", "Soon", "Gone"]);
  expect(screen.getByText(/· Left /)).toBeInTheDocument();
  expect(screen.getByText(/· Leaving /)).toBeInTheDocument();
});
