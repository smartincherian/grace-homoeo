// src/features/consultations/ConsultationFields.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ConsultationFields from "./ConsultationFields";
import type { Consultation } from "./consultationSchema";

const blank: Consultation = {
  id: "c1",
  patientId: "p1",
  patientName: "Asha",
  serialNo: 7,
  date: 1,
  complaint: "",
  generals: "",
  allergy: "",
  history: "",
  diagnosis: "",
  testsRequired: "",
  remedy: "",
  differentialRemedy: "",
  followupCriteria: "",
  remarks: "",
  amount: 0,
  paymentMode: "Cash",
  createdAt: 1,
};

describe("ConsultationFields", () => {
  it("shows only the fields that were filled in", () => {
    render(
      <ConsultationFields
        c={{
          ...blank,
          complaint: "headache",
          history: "cough",
          remedy: "Kali bi",
        }}
      />,
    );
    expect(screen.getByText("headache")).toBeInTheDocument();
    expect(screen.getByText("cough")).toBeInTheDocument();
    expect(screen.getByText("Kali bi")).toBeInTheDocument();
    expect(screen.queryByText("Generals")).not.toBeInTheDocument();
    expect(screen.queryByText("Remarks")).not.toBeInTheDocument();
    expect(screen.queryByText("Diagnosis")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("hides a section whose fields are all empty", () => {
    render(<ConsultationFields c={{ ...blank, remedy: "Kali bi" }} />);
    expect(screen.queryByText("Case notes")).not.toBeInTheDocument();
  });

  it("says so when nothing was recorded", () => {
    render(<ConsultationFields c={blank} />);
    expect(screen.getByText("No details recorded")).toBeInTheDocument();
  });
});
