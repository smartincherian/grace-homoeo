// src/features/patients/PatientListPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const data = [
  { id: "p1", name: "Asha", nameLower: "asha", dob: 946684800000, gender: "Female", place: "Kochi", phone: "111", serialNo: 1, createdAt: 1, lastVisitAt: 946684800000 },
  { id: "p2", name: "Biju", nameLower: "biju", dob: 946684800000, gender: "Male", place: "Aluva", phone: "222", serialNo: 2, createdAt: 1, lastVisitAt: null },
];
vi.mock("./usePatients", () => ({
  usePatients: () => ({ status: "success", data }),
}));

import PatientListPage from "./PatientListPage";

const renderPage = () =>
  render(<MemoryRouter><PatientListPage /></MemoryRouter>);

describe("PatientListPage", () => {
  it("lists patients", () => {
    renderPage();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Biju")).toBeInTheDocument();
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/search/i), "biju");
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.getByText("Biju")).toBeInTheDocument();
  });

  it("filters by phone", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/search/i), "111");
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.queryByText("Biju")).not.toBeInTheDocument();
  });
});
