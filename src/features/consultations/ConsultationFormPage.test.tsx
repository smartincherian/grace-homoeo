// src/features/consultations/ConsultationFormPage.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { GeneralsRecord, LsmcRow } from "./caseRecordSchema";
import type { Consultation } from "./consultationSchema";

const state = vi.hoisted(() => ({
  gender: "Male" as string,
  existing: undefined as Consultation | undefined,
  patientGenerals: undefined as GeneralsRecord[] | undefined,
  visitGenerals: null as GeneralsRecord | null,
  visitLsmc: [] as LsmcRow[],
  visitGeneralsError: false,
}));
const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());

vi.mock("../patients/usePatients", () => ({
  usePatient: () => ({
    data: { id: "p1", name: "Asha", serialNo: 7, gender: state.gender },
    isLoading: false,
  }),
}));
vi.mock("./useConsultations", () => ({
  useConsultation: (cid?: string) => ({
    data: cid ? state.existing : undefined,
    isPending: !!cid && !state.existing,
  }),
  useCreateConsultation: () => ({ mutateAsync: create, isPending: false }),
  useUpdateConsultation: () => ({ mutateAsync: update, isPending: false }),
}));
vi.mock("./useCaseRecord", () => ({
  usePatientGenerals: () => ({
    data: state.patientGenerals,
    isPending: state.patientGenerals === undefined,
  }),
  useConsultationGenerals: () => ({
    data: state.visitGeneralsError ? undefined : state.visitGenerals,
    isPending: false,
    isError: state.visitGeneralsError,
  }),
  useConsultationLsmc: () => ({ data: state.visitLsmc, isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import ConsultationFormPage from "./ConsultationFormPage";
import { EMPTY_GENERALS } from "./caseRecordSchema";
import { dateInputToMs } from "../../lib/dates";

const META = { patientId: "p1", consultationId: "c0", updatedAt: 1 };
const generalsRec = (
  over: Partial<GeneralsRecord> & { date: number },
): GeneralsRecord => ({
  ...EMPTY_GENERALS,
  ...META,
  id: "c0",
  ...over,
});

const consultation: Consultation = {
  id: "c1",
  patientId: "p1",
  patientName: "Asha",
  serialNo: 7,
  date: dateInputToMs("2026-06-17"),
  complaint: "fever",
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

const lsmcRow = (id: string, location: string): LsmcRow => ({
  id,
  patientId: "p1",
  consultationId: "c1",
  date: consultation.date,
  location,
  sensation: "",
  modality: "",
  concomitant: "",
  createdAt: 1,
});

function renderNew() {
  return render(
    <MemoryRouter initialEntries={["/patients/p1/consultations/new"]}>
      <Routes>
        <Route
          path="/patients/:patientId/consultations/new"
          element={<ConsultationFormPage />}
        />
        <Route path="/patients/:id" element={<div>detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/patients/p1/consultations/c1/edit"]}>
      <Routes>
        <Route
          path="/patients/:patientId/consultations/:cid/edit"
          element={<ConsultationFormPage />}
        />
        <Route
          path="/patients/:patientId/consultations/:cid"
          element={<div>detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.gender = "Male";
  state.existing = undefined;
  state.patientGenerals = [];
  state.visitGenerals = null;
  state.visitLsmc = [];
  state.visitGeneralsError = false;
  create.mockReset().mockResolvedValue("c-new");
  update.mockReset().mockResolvedValue(undefined);
});

describe("ConsultationFormPage (create)", () => {
  it("submits a new consultation with the patient ref", async () => {
    const user = userEvent.setup();
    renderNew();
    fireEvent.change(screen.getByLabelText(/^date/i), {
      target: { value: "2026-06-17" },
    });
    await user.type(screen.getByLabelText(/complaint/i), "fever");
    await user.type(screen.getByLabelText(/^prescription/i), "Bryonia 30");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.patient).toEqual({ id: "p1", name: "Asha", serialNo: 7 });
    expect(arg.values.complaint).toBe("fever");
    expect(arg.values.paymentMode).toBe("Cash");
    expect(arg.values.date).toBe(dateInputToMs("2026-06-17"));
    expect(arg.values.remedy).toBe("Bryonia 30");
    expect(arg.values.differentialRemedy).toBe("");
    expect(arg.values).not.toHaveProperty("generals");
    expect(arg.values).not.toHaveProperty("lsmc");
  });

  it("submits generals and LSMC rows with a new consultation", async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText("Thirst"), "thirstless");
    await user.click(screen.getByRole("button", { name: /add row/i }));
    await user.type(screen.getByLabelText("Location"), "head");
    await user.click(screen.getByRole("button", { name: /save/i }));
    const { record } = create.mock.calls[0][0];
    expect(record.generals.thirst).toBe("thirstless");
    expect(record.lsmc).toHaveLength(1);
    expect(record.lsmc[0].location).toBe("head");
  });

  it("pre-fills generals from the patient's latest record, except LMP", async () => {
    state.gender = "Female";
    state.patientGenerals = [
      generalsRec({
        date: 2,
        appetite: "good",
        lmp: dateInputToMs("2026-05-01"),
      }),
      generalsRec({ date: 1, appetite: "poor" }),
    ];
    renderNew();
    expect(await screen.findByDisplayValue("good")).toBe(
      screen.getByLabelText("Appetite"),
    );
    expect(screen.getByLabelText("LMP")).toHaveValue("");
  });

  it("does not save generals when the pre-filled values are unchanged", async () => {
    const user = userEvent.setup();
    state.patientGenerals = [generalsRec({ date: 2, appetite: "good" })];
    renderNew();
    await screen.findByDisplayValue("good");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(create.mock.calls[0][0].record.generals).toBeNull();
  });

  it("saves the full generals snapshot when one field is changed", async () => {
    const user = userEvent.setup();
    state.patientGenerals = [generalsRec({ date: 2, appetite: "good" })];
    renderNew();
    await screen.findByDisplayValue("good");
    await user.type(screen.getByLabelText("Thirst"), "low");
    await user.click(screen.getByRole("button", { name: /save/i }));
    const { generals } = create.mock.calls[0][0].record;
    expect(generals.thirst).toBe("low");
    expect(generals.appetite).toBe("good");
  });

  it("does not overwrite generals typed before the latest record loads", async () => {
    const user = userEvent.setup();
    state.patientGenerals = undefined;
    const view = renderNew();
    await user.type(screen.getByLabelText("Appetite"), "typed");
    state.patientGenerals = [
      generalsRec({ date: 2, appetite: "good", thirst: "low" }),
    ];
    view.rerender(
      <MemoryRouter initialEntries={["/patients/p1/consultations/new"]}>
        <Routes>
          <Route
            path="/patients/:patientId/consultations/new"
            element={<ConsultationFormPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByDisplayValue("low")).toBeInTheDocument();
    expect(screen.getByLabelText("Appetite")).toHaveValue("typed");
  });

  it("shows menstrual fields only for female patients", () => {
    const { unmount } = renderNew();
    expect(screen.queryByLabelText("LMP")).not.toBeInTheDocument();
    unmount();
    state.gender = "Female";
    renderNew();
    expect(screen.getByLabelText("LMP")).toBeInTheDocument();
    expect(screen.getByLabelText("Menarche")).toBeInTheDocument();
  });
});

describe("ConsultationFormPage (create) loading", () => {
  it("keeps Save disabled until the patient's generals have loaded", () => {
    state.patientGenerals = undefined;
    renderNew();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });
});

describe("ConsultationFormPage (edit)", () => {
  it("keeps stored menstrual values when editing a non-female patient", async () => {
    const user = userEvent.setup();
    state.existing = consultation;
    state.visitGenerals = generalsRec({
      date: consultation.date,
      id: "c1",
      consultationId: "c1",
      menarche: "13",
      thirst: "low",
    });
    renderEdit();
    await screen.findByDisplayValue("low");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(update.mock.calls[0][0].record.generals.menarche).toBe("13");
  });

  it("passes existing LSMC ids so removed rows are deleted", async () => {
    const user = userEvent.setup();
    state.existing = consultation;
    state.visitLsmc = [lsmcRow("l1", "head"), lsmcRow("l2", "knee")];
    renderEdit();
    await screen.findByDisplayValue("knee");
    const removes = screen.getAllByRole("button", { name: /remove row/i });
    await user.click(removes[1]);
    await user.click(screen.getByRole("button", { name: /save/i }));
    const vars = update.mock.calls[0][0];
    expect(vars.existingLsmcIds).toEqual(["l1", "l2"]);
    expect(vars.record.lsmc).toHaveLength(1);
    expect(vars.record.lsmc[0]).toMatchObject({ id: "l1", location: "head" });
  });

  it("pre-fills from generals before this visit when it has none, saving only if changed", async () => {
    const user = userEvent.setup();
    state.existing = consultation;
    state.patientGenerals = [
      generalsRec({ date: consultation.date + 1, appetite: "later" }),
      generalsRec({ date: consultation.date - 1, appetite: "earlier" }),
    ];
    renderEdit();
    await screen.findByDisplayValue("earlier");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(update.mock.calls[0][0].record.generals).toBeNull();
  });

  it("blocks saving and says so when the visit's generals fail to load", async () => {
    state.existing = consultation;
    state.visitGeneralsError = true;
    renderEdit();
    expect(
      await screen.findByText(/couldn't load generals/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("uses the LSMC ids from when the form loaded, not a later refetch", async () => {
    const user = userEvent.setup();
    state.existing = consultation;
    state.visitLsmc = [lsmcRow("l1", "head")];
    const view = renderEdit();
    await screen.findByDisplayValue("head");
    // A refetch brings in a row added elsewhere after the form loaded.
    state.visitLsmc = [lsmcRow("l1", "head"), lsmcRow("l9", "other device")];
    view.rerender(
      <MemoryRouter initialEntries={["/patients/p1/consultations/c1/edit"]}>
        <Routes>
          <Route
            path="/patients/:patientId/consultations/:cid/edit"
            element={<ConsultationFormPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(update.mock.calls[0][0].existingLsmcIds).toEqual(["l1"]);
  });
});
