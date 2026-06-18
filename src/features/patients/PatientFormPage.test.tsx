// src/features/patients/PatientFormPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mutateAsync = vi.fn().mockResolvedValue("new-id");
vi.mock("./usePatients", () => ({
  usePatient: () => ({ data: undefined, isLoading: false }),
  useCreatePatient: () => ({ mutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import PatientFormPage from "./PatientFormPage";

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/patients/new"]}>
      <Routes>
        <Route path="/patients/new" element={<PatientFormPage />} />
        <Route path="/patients/:id" element={<div>detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PatientFormPage (create)", () => {
  it("submits a valid new patient", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/name/i), "Asha");
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    // gender defaults to Female; place/phone optional
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.name).toBe("Asha");
    expect(typeof arg.dob).toBe("number");
  });

  it("shows a validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });
});
