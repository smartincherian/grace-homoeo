import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlotTakenError } from "./bookingsRepo";

const TZ = "Asia/Kolkata";
const SLOT = {
  start: Date.UTC(2026, 10, 2, 4, 0), // 9:30 AM Kolkata
  end: Date.UTC(2026, 10, 2, 4, 15),
};

const bookAsync = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("./useBookings", () => ({
  usePatientChoices: () => ({
    data: [
      { id: "p1", name: "Asha Menon", serialNo: 12, phone: "9876543210" },
      { id: "p2", name: "Biju", serialNo: 7, phone: "9000000001" },
    ],
    status: "success",
  }),
  useBookAppointment: () => ({ mutateAsync: bookAsync, isPending: false }),
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "Doc@Example.com " }, loading: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import BookDialog from "./BookDialog";

const onClose = vi.fn();
beforeEach(() => {
  bookAsync.mockReset();
  showToast.mockReset();
  onClose.mockReset();
});

const renderDialog = () =>
  render(<BookDialog slot={SLOT} tz={TZ} onClose={onClose} />);

test("picking an existing patient (found by serial) books with their id and serial", async () => {
  const user = userEvent.setup();
  bookAsync.mockResolvedValue(undefined);
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "#12");
  await user.click(await screen.findByRole("option", { name: /asha menon/i }));
  expect(screen.getByLabelText(/phone/i)).toHaveValue("9876543210");
  await user.type(screen.getByLabelText(/note/i), "Follow-up");
  await user.click(screen.getByRole("button", { name: "Book" }));
  await waitFor(() => expect(bookAsync).toHaveBeenCalledTimes(1));
  expect(bookAsync).toHaveBeenCalledWith({
    slot: SLOT,
    values: {
      patientId: "p1",
      patientName: "Asha Menon",
      phone: "9876543210",
      serialNo: 12,
      note: "Follow-up",
    },
    by: "doc@example.com",
    tz: TZ,
  });
  expect(showToast).toHaveBeenCalledWith("Booked 9:30 AM", "success");
  expect(onClose).toHaveBeenCalled();
});

test("matches patients by phone", async () => {
  const user = userEvent.setup();
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "90000");
  expect(
    await screen.findByRole("option", { name: /biju/i }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /asha/i })).toBeNull();
});

test("a new name without a phone still books", async () => {
  const user = userEvent.setup();
  bookAsync.mockResolvedValue(undefined);
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "Newcomer");
  await user.click(screen.getByRole("button", { name: "Book" }));
  await waitFor(() => expect(bookAsync).toHaveBeenCalledTimes(1));
  expect(bookAsync.mock.calls[0][0].values.phone).toBe("");
});

test("a new patient with a phone books without a patient id", async () => {
  const user = userEvent.setup();
  bookAsync.mockResolvedValue(undefined);
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "Newcomer");
  await user.type(screen.getByLabelText(/phone/i), "9111111111");
  await user.click(screen.getByRole("button", { name: "Book" }));
  await waitFor(() => expect(bookAsync).toHaveBeenCalledTimes(1));
  expect(bookAsync.mock.calls[0][0].values).toEqual({
    patientId: null,
    patientName: "Newcomer",
    phone: "9111111111",
    serialNo: null,
    note: "",
  });
});

test("a taken slot shows 'Slot just taken' and closes", async () => {
  const user = userEvent.setup();
  bookAsync.mockRejectedValue(new SlotTakenError());
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "Newcomer");
  await user.type(screen.getByLabelText(/phone/i), "9111111111");
  await user.click(screen.getByRole("button", { name: "Book" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith("Slot just taken", "error"),
  );
  expect(onClose).toHaveBeenCalled();
});

test("another failure keeps the dialog open", async () => {
  const user = userEvent.setup();
  bookAsync.mockRejectedValue(new Error("offline"));
  renderDialog();
  await user.type(screen.getByLabelText(/patient name/i), "Newcomer");
  await user.type(screen.getByLabelText(/phone/i), "9111111111");
  await user.click(screen.getByRole("button", { name: "Book" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Could not book. Please try again.",
      "error",
    ),
  );
  expect(onClose).not.toHaveBeenCalled();
});
