// src/features/consultations/ConsultationFields.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  EMPTY_GENERALS,
  type GeneralsRecord,
  type LsmcRow,
} from "./caseRecordSchema";

const record = vi.hoisted(() => ({
  generals: null as GeneralsRecord | null,
  lsmc: [] as LsmcRow[],
}));
vi.mock("./useCaseRecord", () => ({
  useConsultationGenerals: () => ({ data: record.generals }),
  useConsultationLsmc: () => ({ data: record.lsmc }),
}));

import ConsultationFields from "./ConsultationFields";
import type { Consultation } from "./consultationSchema";

beforeEach(() => {
  record.generals = null;
  record.lsmc = [];
});

const blank: Consultation = {
  id: "c1",
  patientId: "p1",
  patientName: "Asha",
  serialNo: 7,
  date: 1,
  complaint: "",
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
    expect(screen.queryByText("LSMC")).not.toBeInTheDocument();
    expect(screen.queryByText("Followup criteria")).not.toBeInTheDocument();
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

  it("shows the visit's generals and LSMC", () => {
    record.generals = {
      ...EMPTY_GENERALS,
      thirst: "thirstless",
      id: "c1",
      patientId: "p1",
      consultationId: "c1",
      date: 1,
      updatedAt: 1,
    };
    record.lsmc = [
      {
        id: "l1",
        patientId: "p1",
        consultationId: "c1",
        date: 1,
        location: "Head",
        sensation: "",
        modality: "",
        concomitant: "",
        createdAt: 1,
      },
    ];
    render(<ConsultationFields c={blank} />);
    expect(screen.getByText("Generals")).toBeInTheDocument();
    expect(screen.getByText("thirstless")).toBeInTheDocument();
    expect(screen.getByText("LSMC")).toBeInTheDocument();
    expect(screen.getByText("Head")).toBeInTheDocument();
    expect(screen.queryByText("No details recorded")).not.toBeInTheDocument();
  });

  it("shows legacy notes when present", () => {
    render(
      <ConsultationFields
        c={{
          ...blank,
          generals: "old generals",
          allergy: "dust",
          history: "asthma",
        }}
      />,
    );
    expect(screen.getByText("Generals (notes)")).toBeInTheDocument();
    expect(screen.getByText("old generals")).toBeInTheDocument();
    expect(screen.getByText("dust")).toBeInTheDocument();
    expect(screen.getByText("asthma")).toBeInTheDocument();
  });
});
