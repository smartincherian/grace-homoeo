import { vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { dateInputToZonedMs } from "../../lib/zonedDates";
import type { Schedule } from "../../lib/schedule";
import type { Appointment, ClosedAppointment } from "../../lib/appointments";

const TZ = "Asia/Kolkata";
const MON = dateInputToZonedMs("2026-11-02", TZ);
const AT_930 = Date.UTC(2026, 10, 2, 4, 0);
const AT_945 = AT_930 + 15 * 60_000;

const weekly = () => ({
  mon: [{ start: "09:30", end: "10:00" }],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
});
const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: String(AT_930),
  date: MON,
  start: AT_930,
  end: AT_945,
  patientId: null,
  patientName: "Asha",
  phone: "98765 43210",
  serialNo: null,
  status: "booked",
  note: "",
  createdBy: "doc@example.com",
  createdAt: 1,
  consultationId: null,
  ...over,
});

const state = vi.hoisted(() => ({
  schedule: undefined as unknown as Schedule,
  appts: [] as Appointment[],
  history: [] as ClosedAppointment[],
  owner: false,
  days: [] as number[],
}));
const closeAsync = vi.hoisted(() => vi.fn());
const arrivedAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../lib/schedule", async (orig) => ({
  ...(await orig<typeof import("../../lib/schedule")>()),
  useSchedule: () => ({ data: state.schedule, status: "success" }),
}));
vi.mock("../../lib/appointments", async (orig) => ({
  ...(await orig<typeof import("../../lib/appointments")>()),
  useDayAppointments: (_c: string, day: number) => {
    state.days.push(day);
    return { data: state.appts, status: "success" };
  },
}));
vi.mock("./useBookings", () => ({
  useDayHistory: () => ({ data: state.history, status: "success" }),
  useCloseAppointment: () => ({ mutateAsync: closeAsync, isPending: false }),
  useMarkArrived: () => ({ mutateAsync: arrivedAsync, isPending: false }),
  usePatientChoices: () => ({ data: [], status: "success" }),
  useBookAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../auth/AuthGuard", () => ({
  useMembership: () => ({
    superadmin: false,
    clinicId: "c1",
    owner: state.owner,
  }),
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "Doc@Example.com" }, loading: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import BookingsPage from "./BookingsPage";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search + l.hash}</p>;
}

const renderPage = (entry = "/c1/bookings") =>
  render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/:clinicSlug/bookings" element={<BookingsPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  // Monday 2026-11-02 08:00 Kolkata.
  vi.useFakeTimers({ toFake: ["Date"], now: Date.UTC(2026, 10, 2, 2, 30) });
  state.schedule = { slotMinutes: 15, weekly: weekly(), holidays: [] };
  state.appts = [];
  state.history = [];
  state.owner = false;
  state.days = [];
  closeAsync.mockReset().mockResolvedValue(undefined);
  arrivedAsync.mockReset().mockResolvedValue(undefined);
  showToast.mockReset();
});
afterEach(() => vi.useRealTimers());

test("lists today's slots in the clinic zone with Book buttons", () => {
  renderPage();
  expect(screen.getByText("9:30 AM")).toBeInTheDocument();
  expect(screen.getByText("9:45 AM")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Book" })).toHaveLength(2);
  expect(state.days).toContain(MON);
});

test("Book opens the book dialog for that slot", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getAllByRole("button", { name: "Book" })[1]);
  expect(
    await screen.findByRole("dialog", { name: /book 9:45 am/i }),
  ).toBeInTheDocument();
});

test("a booked row shows the name, serial, phone and Booked chip", () => {
  state.appts = [appt({ serialNo: 12, patientId: "p1" })];
  renderPage();
  expect(screen.getByText("Asha #12")).toBeInTheDocument();
  expect(screen.getByText("98765 43210")).toBeInTheDocument();
  expect(screen.getByText("Booked")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Book" })).toHaveLength(1);
});

test("a cancelled history entry shows greyed under its row", () => {
  state.history = [
    {
      ...appt({ patientName: "Ravi" }),
      status: "cancelled",
      closedAt: 2,
      closedBy: "doc@example.com",
    },
  ];
  renderPage();
  expect(screen.getByText("Cancelled · Ravi")).toBeInTheDocument();
  // The slot is free again.
  expect(screen.getAllByRole("button", { name: "Book" })).toHaveLength(2);
});

test("without hours it says so; only the owner gets the settings link", () => {
  state.schedule = {
    slotMinutes: 15,
    weekly: { ...weekly(), mon: [] },
    holidays: [],
  };
  const { unmount } = renderPage();
  expect(screen.getByText("Clinic hours not set")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Set clinic hours" })).toBeNull();
  unmount();
  state.owner = true;
  renderPage();
  expect(
    screen.getByRole("link", { name: "Set clinic hours" }),
  ).toHaveAttribute("href", "/c1/settings#clinic-hours");
});

test("a holiday with a booking shows the banner and a still-booked warning", () => {
  state.schedule = {
    slotMinutes: 15,
    weekly: weekly(),
    holidays: [{ date: MON, note: "Diwali" }],
  };
  state.appts = [appt()];
  renderPage();
  expect(
    screen.getByText("Holiday — Diwali. Clinic closed."),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "1 appointment(s) are still booked on this day. Cancel them or keep them.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText("Asha")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Book" })).toBeNull();
});

test("a closed weekday says so; next day moves the ?day param", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Next day" }));
  expect(screen.getByText("Closed on Tuesdays.")).toBeInTheDocument();
  expect(state.days).toContain(dateInputToZonedMs("2026-11-03", TZ));
  await user.click(screen.getByRole("button", { name: "Today" }));
  expect(screen.getByText("9:30 AM")).toBeInTheDocument();
});

test("reads the day from ?day", () => {
  renderPage("/c1/bookings?day=2026-11-09");
  expect(state.days).toContain(dateInputToZonedMs("2026-11-09", TZ));
  // A future Monday: every slot is still bookable.
  expect(screen.getAllByRole("button", { name: "Book" })).toHaveLength(2);
});

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /actions for asha/i }));

test("Arrived marks the appointment arrived", async () => {
  const user = userEvent.setup();
  state.appts = [appt()];
  renderPage();
  await openMenu(user);
  await user.click(screen.getByRole("menuitem", { name: "Arrived" }));
  await waitFor(() =>
    expect(arrivedAsync).toHaveBeenCalledWith(String(AT_930)),
  );
});

test("an arrived appointment offers no Arrived action", async () => {
  const user = userEvent.setup();
  state.appts = [appt({ status: "arrived" })];
  renderPage();
  expect(screen.getByText("Arrived")).toBeInTheDocument();
  await openMenu(user);
  expect(screen.queryByRole("menuitem", { name: "Arrived" })).toBeNull();
  expect(
    screen.getByRole("menuitem", { name: "Register patient" }),
  ).toBeInTheDocument();
});

test("confirming Cancel closes the appointment as cancelled", async () => {
  const user = userEvent.setup();
  state.appts = [appt()];
  renderPage();
  await openMenu(user);
  await user.click(screen.getByRole("menuitem", { name: "Cancel" }));
  const dlg = await screen.findByRole("dialog");
  await user.click(
    within(dlg).getByRole("button", { name: "Cancel appointment" }),
  );
  await waitFor(() =>
    expect(closeAsync).toHaveBeenCalledWith({
      appointment: state.appts[0],
      status: "cancelled",
      by: "doc@example.com",
    }),
  );
  expect(showToast).toHaveBeenCalledWith("Appointment cancelled", "success");
});

test("confirming No-show closes the appointment as no-show", async () => {
  const user = userEvent.setup();
  state.appts = [appt()];
  renderPage();
  await openMenu(user);
  await user.click(screen.getByRole("menuitem", { name: "No-show" }));
  const dlg = await screen.findByRole("dialog");
  await user.click(within(dlg).getByRole("button", { name: "Mark no-show" }));
  await waitFor(() =>
    expect(closeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no-show" }),
    ),
  );
});

test("Start consultation without a patient goes to register, then consult", async () => {
  const user = userEvent.setup();
  state.appts = [appt()];
  renderPage();
  await openMenu(user);
  await user.click(
    screen.getByRole("menuitem", { name: "Start consultation" }),
  );
  expect(screen.getByTestId("where")).toHaveTextContent(
    `/c1/patients/new?appointment=${AT_930}&name=Asha&phone=98765%2043210&day=2026-11-02&then=consultation`,
  );
});

test("Register patient goes to the patient form without then", async () => {
  const user = userEvent.setup();
  state.appts = [appt()];
  renderPage();
  await openMenu(user);
  await user.click(screen.getByRole("menuitem", { name: "Register patient" }));
  expect(screen.getByTestId("where").textContent).toBe(
    `/c1/patients/new?appointment=${AT_930}&name=Asha&phone=98765%2043210&day=2026-11-02`,
  );
});

test("Start consultation with a patient goes to the consultation form", async () => {
  const user = userEvent.setup();
  state.appts = [appt({ patientId: "p1", serialNo: 3 })];
  renderPage();
  await openMenu(user);
  expect(
    screen.queryByRole("menuitem", { name: "Register patient" }),
  ).toBeNull();
  await user.click(
    screen.getByRole("menuitem", { name: "Start consultation" }),
  );
  expect(screen.getByTestId("where").textContent).toBe(
    `/c1/patients/p1/consultations/new?appointment=${AT_930}`,
  );
});

test("a done appointment offers View consultation only", async () => {
  const user = userEvent.setup();
  state.appts = [
    appt({ patientId: "p1", status: "done", consultationId: "k9" }),
  ];
  renderPage();
  expect(screen.getByText("Done")).toBeInTheDocument();
  await openMenu(user);
  expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
    "View consultation",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "View consultation" }));
  expect(screen.getByTestId("where").textContent).toBe(
    "/c1/patients/p1/consultations/k9",
  );
});
