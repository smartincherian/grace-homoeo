// src/features/patients/PatientDetailPage.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const deleteMutate = vi.hoisted(() => vi.fn());
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("./usePatients", () => ({
  useDeletePatient: () => ({ mutate: deleteMutate, isPending: false }),
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
  deleteMutate.mockReset();
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
    expect(screen.getByRole("list")).toHaveTextContent("Bryonia");
  });

  it("shows the last consultation date and how long ago", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p1"]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Last consultation")).toBeInTheDocument();
    // Full date in the summary card; the visit card shows it as a date tile.
    expect(screen.getAllByText("1 Jan 2000")).toHaveLength(1);
    // Once in the summary card, once on the visit card.
    expect(screen.getAllByText(/days ago/)).toHaveLength(2);
    expect(screen.queryByText("Last prescribed")).not.toBeInTheDocument();
  });

  it("shows each general's latest value under one last-updated date", () => {
    const meta = { patientId: "p1", updatedAt: 1 };
    record.generals = [
      {
        ...EMPTY_GENERALS,
        ...meta,
        id: "c2",
        consultationId: "c2",
        date: 946684800000 + 7 * 86_400_000,
        thirst: "Moderate",
      },
      {
        ...EMPTY_GENERALS,
        ...meta,
        id: "c1",
        consultationId: "c1",
        date: 946684800000,
        thirst: "thirstless",
      },
    ];
    renderPage();
    expect(screen.getByText("Generals")).toBeInTheDocument();
    expect(screen.getByText("Thirst")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("8 Jan 2000")).toBeInTheDocument();
    // Earlier values live on the past-history page.
    expect(screen.queryByText("thirstless")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View past history" }),
    ).toHaveAttribute("href", "/patients/p1/generals");
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
    // Shown on the visit card it was recorded in.
    expect(screen.getByText("Sensation")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Throbbing"));
    expect(await screen.findByText("consultation page")).toBeInTheDocument();
  });

  it("hides Generals and LSMC when the patient has none", () => {
    renderPage();
    expect(screen.queryByText("Generals")).not.toBeInTheDocument();
    expect(screen.queryByText("Sensation")).not.toBeInTheDocument();
  });

  it("deletes the patient only after confirming", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete patient?")).toBeInTheDocument();
    expect(
      screen.getByText(/and all 1 consultation, including their fees/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteMutate).toHaveBeenCalledWith("p1", expect.anything());
  });
});
