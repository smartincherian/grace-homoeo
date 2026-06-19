// src/features/patients/PatientDetailPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("./usePatients", () => ({
  usePatient: () => ({
    data: {
      id: "p1",
      name: "Asha",
      serialNo: 7,
      dob: 946684800000,
      gender: "Female",
      place: "Kochi",
      phone: "111",
      lastVisitAt: null,
      createdAt: 1,
      nameLower: "asha",
    },
    isLoading: false,
  }),
}));
vi.mock("../consultations/useConsultations", () => ({
  useConsultations: () => ({
    status: "success",
    data: [
      {
        id: "c1",
        patientId: "p1",
        patientName: "Asha",
        serialNo: 7,
        date: 946684800000,
        complaint: "fever",
        generals: "",
        allergy: "",
        history: "",
        remedy: "Bryonia",
        remarks: "",
        amount: 200,
        paymentMode: "Cash",
        createdAt: 1,
      },
    ],
  }),
}));

import PatientDetailPage from "./PatientDetailPage";

describe("PatientDetailPage", () => {
  it("shows the patient profile and their consultation history", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p1"]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
    expect(screen.getByText(/#7/)).toBeInTheDocument();
    expect(screen.getByText(/fever/i)).toBeInTheDocument();
    expect(screen.getByText(/Bryonia/)).toBeInTheDocument();
  });
});
