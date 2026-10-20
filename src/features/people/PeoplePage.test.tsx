import { vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SeatError, type Seat } from "../../lib/seats";

const seats = vi.hoisted(() => ({ value: [] as Seat[] }));
const addMutate = vi.hoisted(() => vi.fn());
const removeMutate = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../lib/useSeats", () => ({
  useSeats: () => ({ status: "success", data: seats.value }),
  useAddUser: () => ({ mutate: addMutate, isPending: false }),
  useRemoveUser: () => ({ mutate: removeMutate, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinic: () => ({
    data: { id: "c1", name: "C1", createdAt: 0, ownerEmail: "owner@x.com" },
  }),
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "owner@x.com" }, loading: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import PeoplePage from "./PeoplePage";
import { PageChromeProvider } from "../../components/PageChrome";

const renderPage = () =>
  render(
    <PageChromeProvider>
      <MemoryRouter initialEntries={["/c1/people"]}>
        <Routes>
          <Route path="/:clinicSlug/people" element={<PeoplePage />} />
        </Routes>
      </MemoryRouter>
    </PageChromeProvider>,
  );

const MAX = "This clinic has the maximum of 3 users.";

beforeEach(() => {
  seats.value = [
    { seat: "1", email: "owner@x.com" },
    { seat: "2", email: "m@x.com" },
  ];
  addMutate.mockReset();
  removeMutate.mockReset();
  showToast.mockReset();
});

test("lists seats with Owner and Member chips and the count", () => {
  renderPage();
  expect(screen.getByText("owner@x.com")).toBeInTheDocument();
  expect(screen.getByText("m@x.com")).toBeInTheDocument();
  expect(screen.getByText("Owner")).toBeInTheDocument();
  expect(screen.getByText("Member")).toBeInTheDocument();
  expect(screen.getByText("2 of 3 users")).toBeInTheDocument();
  expect(
    screen.getByText(
      "Added users sign in with Google, or create a password on the login page and verify their email.",
    ),
  ).toBeInTheDocument();
});

test("adds a user with the current seats and signed-in email", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.type(screen.getByLabelText(/email/i), "new@x.com");
  await user.click(screen.getByRole("button", { name: "Add user" }));
  expect(addMutate).toHaveBeenCalledWith(
    { email: "new@x.com", addedBy: "owner@x.com", seats: seats.value },
    expect.any(Object),
  );
});

test("disables adding at 3 users", () => {
  seats.value = [...seats.value, { seat: "3", email: "z@x.com" }];
  renderPage();
  expect(screen.getByRole("button", { name: "Add user" })).toBeDisabled();
  expect(screen.getByText(MAX)).toBeInTheDocument();
});

test.each([
  ["duplicate", "Already a user of this clinic."],
  ["superadmin", "Enter a valid email address."],
  ["invalid", "Enter a valid email address."],
  ["unavailable", "This email can't be added."],
  ["full", MAX],
] as const)("maps %s error to a toast", async (code, message) => {
  const user = userEvent.setup();
  addMutate.mockImplementation((_v, opts) => opts.onError(new SeatError(code)));
  renderPage();
  await user.type(screen.getByLabelText(/email/i), "new@x.com");
  await user.click(screen.getByRole("button", { name: "Add user" }));
  expect(showToast).toHaveBeenCalledWith(message, "error");
});

test("clears the field after a successful add", async () => {
  const user = userEvent.setup();
  addMutate.mockImplementation((_v, opts) => opts.onSuccess());
  renderPage();
  await user.type(screen.getByLabelText(/email/i), "new@x.com");
  await user.click(screen.getByRole("button", { name: "Add user" }));
  await waitFor(() => expect(screen.getByLabelText(/email/i)).toHaveValue(""));
});

test("removes a member after confirmation, never the owner", async () => {
  const user = userEvent.setup();
  renderPage();
  expect(
    screen.queryByRole("button", { name: "Remove owner@x.com" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove m@x.com" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText(
      "Remove m@x.com? They will lose access immediately.",
    ),
  ).toBeInTheDocument();
  await user.click(within(dialog).getByRole("button", { name: "Remove" }));
  expect(removeMutate).toHaveBeenCalledWith(
    { seat: seats.value[1], ownerEmail: "owner@x.com" },
    expect.any(Object),
  );
});
