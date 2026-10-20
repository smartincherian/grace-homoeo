import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({
  q: { status: "success", data: [] as unknown[] } as {
    status: string;
    data?: unknown[];
  },
}));
const useDay = vi.hoisted(() => vi.fn());
vi.mock("../lib/appointments", () => ({
  useDayAppointments: useDay,
}));
vi.mock("../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));

import TodayAppointments from "./TodayAppointments";

const at = (h: number, m: number) => Date.UTC(2026, 10, 2, h, m) - 19800000;
const renderIt = () =>
  render(
    <MemoryRouter initialEntries={["/c1/patients"]}>
      <Routes>
        <Route
          path="/:clinicSlug/*"
          element={<TodayAppointments clinicId="c1" />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("TodayAppointments", () => {
  afterEach(() => vi.useRealTimers());

  it("queries the clinic-zone day start, not the device zone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T19:00:00Z"));
    state.q = { status: "success", data: [] };
    useDay.mockImplementation(() => state.q);
    renderIt();
    expect(useDay).toHaveBeenCalledWith("c1", Date.UTC(2026, 10, 1, 18, 30));
  });

  it("moves to the new day after midnight without a remount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T19:00:00Z"));
    state.q = { status: "success", data: [] };
    useDay.mockImplementation(() => state.q);
    renderIt();
    act(() => {
      vi.advanceTimersByTime(24 * 3600_000);
    });
    expect(useDay).toHaveBeenLastCalledWith(
      "c1",
      Date.UTC(2026, 10, 2, 18, 30),
    );
  });

  it("lists appointments in order with statuses and links to bookings", () => {
    useDay.mockImplementation(() => state.q);
    state.q = {
      status: "success",
      data: [
        { id: "1", start: at(9, 30), patientName: "Ravi", status: "booked" },
        { id: "2", start: at(9, 45), patientName: "Mini", status: "arrived" },
      ],
    };
    renderIt();
    expect(screen.getByText("Today's appointments")).toBeInTheDocument();
    const items = screen.getAllByRole("link", { name: /·/ });
    expect(items[0]).toHaveTextContent("9:30 AM · Ravi · Booked");
    expect(items[1]).toHaveTextContent("9:45 AM · Mini · Arrived");
    expect(items[0]).toHaveAttribute("href", "/c1/bookings");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/c1/bookings",
    );
  });

  it("renders nothing when empty, loading or errored", () => {
    for (const q of [
      { status: "success", data: [] },
      { status: "pending" },
      { status: "error" },
    ]) {
      state.q = q;
      useDay.mockImplementation(() => state.q);
      const { container, unmount } = renderIt();
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
