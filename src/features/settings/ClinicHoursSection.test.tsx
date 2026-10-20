import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_SCHEDULE,
  OffGridError,
  type Schedule,
} from "../../lib/schedule";
import type { Appointment } from "../../lib/appointments";

const sched = vi.hoisted(() => ({ value: undefined as Schedule | undefined }));
const saveAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../lib/schedule", async (orig) => ({
  ...(await orig<typeof import("../../lib/schedule")>()),
  useSchedule: () => ({ data: sched.value, isError: false }),
  useSaveSchedule: () => ({ mutateAsync: saveAsync, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "Owner@X.com" }, loading: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import ClinicHoursSection from "./ClinicHoursSection";

const withMonday = (): Schedule => ({
  ...DEFAULT_SCHEDULE,
  weekly: {
    ...DEFAULT_SCHEDULE.weekly,
    mon: [{ start: "09:30", end: "13:00" }],
  },
});

beforeEach(() => {
  sched.value = withMonday();
  saveAsync.mockReset();
  saveAsync.mockResolvedValue(undefined);
  showToast.mockReset();
});

const saveBtn = () => screen.getByRole("button", { name: "Save hours" });

describe("ClinicHoursSection", () => {
  it("shows existing sessions and Closed days", () => {
    render(<ClinicHoursSection clinicId="c1" />);
    expect(screen.getByLabelText("Monday start 1")).toHaveValue("09:30");
    expect(screen.getByLabelText("Monday end 1")).toHaveValue("13:00");
    expect(screen.getByTestId("day-tue")).toHaveTextContent("Closed");
  });

  it("saves a changed slot length and toasts", async () => {
    render(<ClinicHoursSection clinicId="c1" />);
    await userEvent.selectOptions(screen.getByLabelText("Slot length"), "20");
    await userEvent.click(saveBtn());
    await waitFor(() => expect(saveAsync).toHaveBeenCalled());
    expect(saveAsync.mock.calls[0][0]).toMatchObject({
      schedule: { slotMinutes: 20 },
      by: "owner@x.com",
      tz: "Asia/Kolkata",
    });
    expect(showToast).toHaveBeenCalledWith("Clinic hours saved", "success");
  });

  it("warns and lists bookings on OffGridError, without success toast", async () => {
    const appt = {
      start: Date.UTC(2030, 0, 7, 4, 45),
      end: Date.UTC(2030, 0, 7, 5, 0),
      patientName: "Ravi",
    } as Appointment;
    saveAsync.mockRejectedValue(new OffGridError([appt]));
    render(<ClinicHoursSection clinicId="c1" />);
    await userEvent.click(saveBtn());
    expect(
      await screen.findByText(
        "These future bookings don't fit the new hours or slot length. Cancel them in Bookings first, then save.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ravi/)).toBeInTheDocument();
    expect(showToast).not.toHaveBeenCalledWith("Clinic hours saved", "success");
  });

  it("rejects End before Start without saving", async () => {
    render(<ClinicHoursSection clinicId="c1" />);
    const end = screen.getByLabelText("Monday end 1");
    await userEvent.clear(end);
    await userEvent.type(end, "08:00");
    await userEvent.click(saveBtn());
    expect(await screen.findByText(/End must be after start/)).toBeVisible();
    expect(saveAsync).not.toHaveBeenCalled();
  });

  it("adds and removes sessions", async () => {
    render(<ClinicHoursSection clinicId="c1" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Add session Tuesday" }),
    );
    expect(screen.getByLabelText("Tuesday start 1")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Tuesday session 1" }),
    );
    expect(screen.getByTestId("day-tue")).toHaveTextContent("Closed");
  });

  it("adds a holiday and includes it in the payload", async () => {
    render(<ClinicHoursSection clinicId="c1" />);
    await userEvent.type(screen.getByLabelText("Holiday date"), "2099-12-25");
    await userEvent.type(screen.getByLabelText("Holiday note"), "Christmas");
    await userEvent.click(screen.getByRole("button", { name: "Add holiday" }));
    expect(screen.getByText(/Christmas/)).toBeInTheDocument();
    await userEvent.click(saveBtn());
    await waitFor(() => expect(saveAsync).toHaveBeenCalled());
    const hol = saveAsync.mock.calls[0][0].schedule.holidays;
    expect(hol).toEqual([
      { date: Date.UTC(2099, 11, 24, 18, 30), note: "Christmas" },
    ]);
  });
});
