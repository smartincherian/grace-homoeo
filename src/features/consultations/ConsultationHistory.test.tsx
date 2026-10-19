// src/features/consultations/ConsultationHistory.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ConsultationHistory from "./ConsultationHistory";
import type { Consultation } from "./consultationSchema";

const base: Consultation = {
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
  testsRequired: "",
  remedy: "Bryonia 30",
  differentialRemedy: "",
  followupCriteria: "",
  remarks: "",
  amount: 200,
  paymentMode: "Cash",
  createdAt: 1,
};
const visits: Consultation[] = [
  {
    ...base,
    id: "c2",
    date: 949363200000,
    diagnosis: "Cough",
    remedy: "Drosera 200",
    generals: "Thirstless",
  },
  base,
];

function renderHistory() {
  render(
    <MemoryRouter>
      <ConsultationHistory consultations={visits} patientId="p1" />
    </MemoryRouter>,
  );
}

describe("ConsultationHistory", () => {
  it("lists every visit with its key details in a table", () => {
    renderHistory();
    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Cough")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Drosera 200")).toBeInTheDocument();
  });

  it("calls onSelect instead of opening the drawer when given", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <ConsultationHistory
          consultations={visits}
          patientId="p1"
          onSelect={onSelect}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByText("Drosera 200"));
    expect(onSelect).toHaveBeenCalledWith("c2");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the full details of a visit in a drawer when its row is clicked", async () => {
    const user = userEvent.setup();
    renderHistory();
    expect(screen.queryByText("Thirstless")).not.toBeInTheDocument();
    await user.click(screen.getByText("Drosera 200"));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Thirstless")).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /open/i })).toHaveAttribute(
      "href",
      "/patients/p1/consultations/c2",
    );
    expect(within(drawer).getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/patients/p1/consultations/c2/edit",
    );
  });
});
