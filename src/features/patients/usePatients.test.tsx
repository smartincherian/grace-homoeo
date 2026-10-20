// src/features/patients/usePatients.test.tsx
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./patientsRepo", () => ({
  listPatients: vi.fn().mockResolvedValue([{ id: "p1", name: "Asha" }]),
  getPatient: vi.fn(),
  createPatient: vi.fn().mockResolvedValue("pid"),
  updatePatient: vi.fn(),
}));

import { createPatient } from "./patientsRepo";
import { useCreatePatient, usePatients } from "./usePatients";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePatients", () => {
  it("returns the patient list from the repository", async () => {
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "p1", name: "Asha" }]);
  });
});

describe("useCreatePatient", () => {
  it("passes the appointment id and refreshes appointments", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreatePatient(), { wrapper });
    const values = {
      name: "A",
      dob: 1,
      gender: "Female" as const,
      place: "",
      phone: "",
    };
    await act(() => result.current.mutateAsync({ values, appointmentId: "9" }));
    expect(createPatient).toHaveBeenCalledWith(values, "9");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["appointments"] });
  });
});
