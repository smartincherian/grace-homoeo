// src/features/patients/PatientFormPage.test.tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const mutateAsync = vi.fn().mockResolvedValue("new-id");
vi.mock("./usePatients", () => ({
  usePatient: () => ({ data: undefined, isLoading: false }),
  usePatients: () => ({ data: [] }),
  useCreatePatient: () => ({ mutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import PatientFormPage from "./PatientFormPage";

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

function renderCreate(url = "/c1/patients/new") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/:clinicSlug/patients/new" element={<PatientFormPage />} />
        <Route path="/:clinicSlug/patients/:id" element={<div>detail</div>} />
        <Route
          path="/:clinicSlug/patients/:id/consultations/new"
          element={<LocationProbe />}
        />
        <Route path="/:clinicSlug/bookings" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PatientFormPage (create)", () => {
  beforeEach(() => mutateAsync.mockClear());
  it("submits a valid new patient", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/name/i), "Asha");
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    // gender defaults to Female; place/phone optional
    await user.click(screen.getByRole("button", { name: /save only/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0].values;
    expect(arg.name).toBe("Asha");
    expect(typeof arg.dob).toBe("number");
  });

  it("saves a patient with only a name (no date of birth or phone)", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/name/i), "Asha");
    await user.click(screen.getByRole("button", { name: /save only/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync.mock.calls[0][0].values).toMatchObject({
      name: "Asha",
      dob: null,
      phone: "",
    });
  });

  it("shows a validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    await user.click(screen.getByRole("button", { name: /save only/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });
});

describe("PatientFormPage from an appointment", () => {
  const URL =
    "/c1/patients/new?appointment=123&name=Ravi&phone=98&day=2026-11-02&then=consultation";

  beforeEach(() => mutateAsync.mockClear());

  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
  }

  it("prefills name and phone", () => {
    renderCreate(URL);
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Ravi");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("98");
  });

  it("Save & start consultation links the appointment and continues to the consultation", async () => {
    const user = userEvent.setup();
    renderCreate(URL);
    await fill(user);
    await user.click(
      screen.getByRole("button", { name: /save & start consultation/i }),
    );
    expect(mutateAsync.mock.calls[0][0].appointmentId).toBe("123");
    expect(await screen.findByTestId("loc")).toHaveTextContent(
      "/c1/patients/new-id/consultations/new?appointment=123",
    );
  });

  it("plain Save returns to the booking day", async () => {
    const user = userEvent.setup();
    renderCreate(URL);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /save only/i }));
    expect(mutateAsync.mock.calls[0][0].appointmentId).toBe("123");
    expect(await screen.findByTestId("loc")).toHaveTextContent(
      "/c1/bookings?day=2026-11-02",
    );
  });

  it("passes no appointmentId without the param", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/full name/i), "Asha");
    await fill(user);
    await user.click(screen.getByRole("button", { name: /save only/i }));
    expect(mutateAsync.mock.calls[0][0].appointmentId).toBeUndefined();
  });
});
