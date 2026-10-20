import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { Appointment } from "../../lib/appointments";

const closeAppointment = vi.hoisted(() => vi.fn());
const markArrived = vi.hoisted(() => vi.fn());
vi.mock("./bookingsRepo", () => ({
  bookAppointment: vi.fn(),
  closeAppointment: (...a: unknown[]) => closeAppointment(...a),
  listDayHistory: vi.fn(),
  listPatientChoices: vi.fn(),
  markArrived: (...a: unknown[]) => markArrived(...a),
}));

import {
  useCloseAppointment,
  useDayHistory,
  useMarkArrived,
} from "./useBookings";

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, invalidate, wrapper };
}

describe("useBookings refresh", () => {
  it("useCloseAppointment invalidates even when the mutation fails", async () => {
    closeAppointment.mockRejectedValue(new Error("already cancelled"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCloseAppointment(), { wrapper });
    result.current.mutate({
      appointment: { id: "a" } as Appointment,
      status: "cancelled",
      by: "x",
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["appointments"] }),
    );
  });

  it("useMarkArrived invalidates even when the mutation fails", async () => {
    markArrived.mockRejectedValue(new Error("gone"));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useMarkArrived(), { wrapper });
    result.current.mutate("a");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["appointments"] }),
    );
  });

  it("useDayHistory polls every minute", async () => {
    const { qc, wrapper } = setup();
    renderHook(() => useDayHistory("c1", 0), { wrapper });
    const q = qc
      .getQueryCache()
      .findAll({ queryKey: ["appointments", "history"] })[0];
    expect((q?.options as { refetchInterval?: number }).refetchInterval).toBe(
      60_000,
    );
  });
});
