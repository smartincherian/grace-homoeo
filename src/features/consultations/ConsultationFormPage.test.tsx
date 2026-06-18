// src/features/consultations/ConsultationFormPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mutateAsync = vi.fn().mockResolvedValue("c-new");
vi.mock("../patients/usePatients", () => ({
  usePatient: () => ({ data: { id: "p1", name: "Asha", serialNo: 7 }, isLoading: false }),
}));
vi.mock("./useConsultations", () => ({
  useConsultation: () => ({ data: undefined, isLoading: false }),
  useCreateConsultation: () => ({ mutateAsync, isPending: false }),
  useUpdateConsultation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import ConsultationFormPage from "./ConsultationFormPage";

describe("ConsultationFormPage (create)", () => {
  it("submits a new consultation with the patient ref", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/patients/p1/consultations/new"]}>
        <Routes>
          <Route path="/patients/:patientId/consultations/new" element={<ConsultationFormPage />} />
          <Route path="/patients/:id" element={<div>detail</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/date/i), "2026-06-17");
    await user.type(screen.getByLabelText(/complaint/i), "fever");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.patient).toEqual({ id: "p1", name: "Asha", serialNo: 7 });
    expect(arg.values.complaint).toBe("fever");
    expect(arg.values.paymentMode).toBe("Cash");
  });
});
