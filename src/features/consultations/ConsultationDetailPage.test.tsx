// src/features/consultations/ConsultationDetailPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("./useCaseRecord", () => ({
  useConsultationGenerals: () => ({ data: null }),
  useConsultationLsmc: () => ({ data: [] }),
}));

const { current, DAY } = vi.hoisted(() => ({
  DAY: 86_400_000,
  current: {
    id: "c1",
    patientId: "p1",
    patientName: "Asha",
    serialNo: 7,
    date: 946684800000,
    complaint: "fever",
    generals: "",
    allergy: "",
    history: "",
    diagnosis: "Acute fever",
    testsRequired: "CBC",
    remedy: "Bryonia 30, 4 pills TDS",
    differentialRemedy: "",
    followupCriteria: "Review in 3 days",
    remarks: "",
    amount: 200,
    paymentMode: "Cash" as const,
    createdAt: 1,
  },
}));

vi.mock("./useConsultations", () => ({
  useConsultation: () => ({ status: "success", data: current }),
  useConsultations: () => ({
    status: "success",
    // Newest first, as the repo returns them.
    data: [
      {
        ...current,
        id: "c3",
        date: current.date + 3 * DAY,
        remedy: "Newer visit",
        diagnosis: "Cold",
      },
      current,
      {
        ...current,
        id: "c0",
        date: current.date - 3 * DAY,
        remedy: "Older visit",
        diagnosis: "Cold",
      },
    ],
  }),
}));

import ConsultationDetailPage from "./ConsultationDetailPage";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/patients/p1/consultations/c1"]}>
      <Routes>
        <Route
          path="/patients/:patientId/consultations/:cid"
          element={<ConsultationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ConsultationDetailPage", () => {
  it("shows the clinical details of the consultation", () => {
    renderPage();
    expect(screen.getByText("1 Jan 2000")).toBeInTheDocument();
    expect(screen.getByText("Asha · #7")).toBeInTheDocument();
    expect(screen.getByText("Acute fever")).toBeInTheDocument();
    expect(screen.getByText("CBC")).toBeInTheDocument();
    expect(screen.getByText("Bryonia 30, 4 pills TDS")).toBeInTheDocument();
    expect(screen.getByText("Review in 3 days")).toBeInTheDocument();
    // Left blank, so hidden.
    expect(screen.queryByText("Differential remedy")).not.toBeInTheDocument();
  });

  it("keeps previous visits collapsed until the heading is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /previous consultations \(1\)/i }),
    );
    const table = screen.getByRole("list");
    expect(within(table).getByText("Older visit")).toBeInTheDocument();
    expect(within(table).queryByText("Newer visit")).not.toBeInTheDocument();
    expect(within(table).queryByText(/Bryonia/)).not.toBeInTheDocument();
  });

  it("links to the edit form", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/patients/p1/consultations/c1/edit",
    );
  });
});
