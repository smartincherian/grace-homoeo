import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./consultationsRepo", () => ({
  listConsultationsByPatient: vi.fn().mockResolvedValue([{ id: "c1", date: 1 }]),
  getConsultation: vi.fn(),
  createConsultation: vi.fn(),
  updateConsultation: vi.fn(),
}));

import { useConsultations } from "./useConsultations";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useConsultations", () => {
  it("returns the patient's consultations", async () => {
    const { result } = renderHook(() => useConsultations("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", date: 1 }]);
  });

  it("stays disabled when no patientId is given", () => {
    const { result } = renderHook(() => useConsultations(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
