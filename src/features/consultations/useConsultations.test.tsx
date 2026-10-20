import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./consultationsRepo", () => ({
  listConsultationsByPatient: vi
    .fn()
    .mockResolvedValue([{ id: "c1", date: 1 }]),
  getConsultation: vi.fn(),
  createConsultation: vi.fn().mockResolvedValue("cid"),
  updateConsultation: vi.fn(),
}));

import { createConsultation } from "./consultationsRepo";
import { useConsultations, useCreateConsultation } from "./useConsultations";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useConsultations", () => {
  it("returns the patient's consultations", async () => {
    const { result } = renderHook(() => useConsultations("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", date: 1 }]);
  });

  it("stays disabled when no patientId is given", () => {
    const { result } = renderHook(() => useConsultations(undefined), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCreateConsultation", () => {
  it("passes the appointment id and refreshes appointments", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateConsultation("p1"), {
      wrapper,
    });
    const vars = {
      patient: { id: "p1", name: "A", serialNo: 1 },
      values: {} as never,
      record: { generals: null, lsmc: [] },
      appointmentId: "9",
    };
    await act(() => result.current.mutateAsync(vars));
    expect(createConsultation).toHaveBeenCalledWith(
      vars.patient,
      vars.values,
      vars.record,
      "9",
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ["appointments"] });
  });
});
