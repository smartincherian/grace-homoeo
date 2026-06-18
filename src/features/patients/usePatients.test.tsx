// src/features/patients/usePatients.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./patientsRepo", () => ({
  listPatients: vi.fn().mockResolvedValue([{ id: "p1", name: "Asha" }]),
  getPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

import { usePatients } from "./usePatients";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePatients", () => {
  it("returns the patient list from the repository", async () => {
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "p1", name: "Asha" }]);
  });
});
