// src/features/patients/PatientDetailPage.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type {
  GeneralsRecord,
  LsmcRow,
} from "../consultations/caseRecordSchema";

const record = vi.hoisted(() => ({
  generals: [] as GeneralsRecord[],
  lsmc: [] as LsmcRow[],
}));
vi.mock("../consultations/useCaseRecord", () => ({
  usePatientGenerals: () => ({ data: record.generals }),
  usePatientLsmc: () => ({ data: record.lsmc }),
}));

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
import { EMPTY_GENERALS } from "../consultations/caseRecordSchema";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/patients/p1"]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route
          path="/patients/:id/consultations/:cid"
          element={<div>consultation page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  record.generals = [];
  record.lsmc = [];
});

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
    expect(screen.getByRole("table")).toHaveTextContent("Bryonia");
  });

  it("shows the last consultation date, how long ago, and the last prescription", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p1"]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Last consultation")).toBeInTheDocument();
    // Once in the header, once in the history table.
    expect(screen.getAllByText("1 Jan 2000")).toHaveLength(2);
    expect(screen.getAllByText(/days ago/)).toHaveLength(2);
    expect(screen.getByText("Last prescribed")).toBeInTheDocument();
    expect(screen.getAllByText(/Bryonia/).length).toBeGreaterThan(1);
  });

  it("shows the current generals with when they were updated", () => {
    record.generals = [
      {
        ...EMPTY_GENERALS,
        thirst: "thirstless",
        id: "c1",
        patientId: "p1",
        consultationId: "c1",
        date: 946684800000,
        updatedAt: 1,
      },
    ];
    renderPage();
    expect(screen.getByText("Generals")).toBeInTheDocument();
    expect(screen.getByText("Thirst")).toBeInTheDocument();
    expect(screen.getByText("thirstless")).toBeInTheDocument();
    expect(screen.getByText(/Updated 1 Jan 2000/)).toBeInTheDocument();
  });

  it("lists the patient's LSMC rows and opens the linked consultation on click", async () => {
    record.lsmc = [
      {
        id: "l1",
        patientId: "p1",
        consultationId: "c1",
        date: 946684800000,
        location: "Head",
        sensation: "Throbbing",
        modality: "",
        concomitant: "",
        createdAt: 1,
      },
    ];
    renderPage();
    expect(screen.getByText("LSMC")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Throbbing"));
    expect(await screen.findByText("consultation page")).toBeInTheDocument();
  });

  it("hides Generals and LSMC when the patient has none", () => {
    renderPage();
    expect(screen.queryByText("Generals")).not.toBeInTheDocument();
    expect(screen.queryByText("LSMC")).not.toBeInTheDocument();
  });
});
