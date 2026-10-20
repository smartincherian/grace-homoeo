import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: { user: null as { email: string } | null, loading: true },
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../../lib/firebase", () => ({ db: {} }));
type Entry = { email: string; clinicId: string; seat: string; addedAt: number };
const m = vi.hoisted(() => ({
  addUser: vi.fn(),
  removeUser: vi.fn(),
  setOwner: vi.fn(),
  createClinic: vi.fn(),
  toast: vi.fn(),
  emails: [] as Entry[],
  clinics: [] as {
    id: string;
    name: string;
    createdAt: number;
    ownerEmail?: string;
  }[],
}));
vi.mock("./useClinics", () => ({
  useClinics: () => ({
    status: "success",
    data: m.clinics,
  }),
  useCreateClinic: () => ({ mutate: m.createClinic, isPending: false }),
}));
vi.mock("./useAllowedEmails", () => ({
  useAllowedEmails: () => ({ status: "success", data: m.emails }),
}));
vi.mock("../../lib/useSeats", () => ({
  useAddUser: () => ({ mutate: m.addUser, isPending: false }),
  useRemoveUser: () => ({ mutate: m.removeUser, isPending: false }),
  useSetOwner: () => ({ mutate: m.setOwner, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: m.toast }),
}));
vi.mock("../../components/PageChrome", () => ({ useSetPageTitle: () => {} }));

import AccessPage from "./AccessPage";

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/access"]}>
      <Routes>
        <Route path="/access" element={<AccessPage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );

test("does not redirect while auth is still loading", () => {
  auth.value = { user: null, loading: true };
  renderAt();
  expect(screen.queryByText("Home page")).not.toBeInTheDocument();
});

test("shows the page to the superadmin", () => {
  auth.value = { user: { email: "smartin.cherian@gmail.com" }, loading: false };
  renderAt();
  expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
});

test("redirects other users home", () => {
  auth.value = { user: { email: "doc@clinic.com" }, loading: false };
  renderAt();
  expect(screen.getByText("Home page")).toBeInTheDocument();
});

const asAdmin = () => {
  auth.value = { user: { email: "smartin.cherian@gmail.com" }, loading: false };
  for (const f of [
    m.addUser,
    m.removeUser,
    m.setOwner,
    m.createClinic,
    m.toast,
  ])
    f.mockReset();
  m.clinics = [
    { id: "c1", name: "Sunrise", createdAt: 1, ownerEmail: "own@x.com" },
  ];
  m.emails = [
    { email: "own@x.com", clinicId: "c1", seat: "1", addedAt: 0 },
    { email: "two@x.com", clinicId: "c1", seat: "2", addedAt: 0 },
  ];
};

const fillCreate = (name: string, owner: string) => {
  fireEvent.change(screen.getByLabelText("Clinic name"), {
    target: { value: name },
  });
  if (owner)
    fireEvent.change(screen.getByLabelText("Owner email"), {
      target: { value: owner },
    });
};

test("slug auto-fills from name; create needs a valid owner email", () => {
  asAdmin();
  renderAt();
  fillCreate("Sunrise Homoeo", "");
  expect(screen.getByLabelText("Slug")).toHaveValue("sunrise-homoeo");
  const btn = screen.getByRole("button", { name: "Create clinic" });
  expect(btn).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Owner email"), {
    target: { value: "bad" },
  });
  expect(btn).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Owner email"), {
    target: { value: "Dr@X.com" },
  });
  expect(btn).toBeEnabled();
  fireEvent.click(btn);
  expect(m.createClinic).toHaveBeenCalledWith(
    {
      id: "sunrise-homoeo",
      name: "Sunrise Homoeo",
      ownerEmail: "dr@x.com",
      addedBy: "smartin.cherian@gmail.com",
    },
    expect.anything(),
  );
});

test("invalid slug disables create and shows helper text", () => {
  asAdmin();
  renderAt();
  fillCreate("X", "dr@x.com");
  fireEvent.change(screen.getByLabelText("Slug"), {
    target: { value: "Bad Slug" },
  });
  expect(screen.getByRole("button", { name: "Create clinic" })).toBeDisabled();
  expect(
    screen.getByText("Lowercase letters, numbers and hyphens (3–40)"),
  ).toBeInTheDocument();
});

test("lists clinic users with seat, owner chip and actions", () => {
  asAdmin();
  renderAt();
  expect(screen.getByText("own@x.com")).toBeInTheDocument();
  expect(screen.getByText("Owner")).toBeInTheDocument();
  expect(screen.getByText("Seat 2")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Remove own@x.com" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Make own@x.com owner" }),
  ).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Make two@x.com owner" }));
  expect(m.setOwner).toHaveBeenCalledWith(
    { clinicId: "c1", email: "two@x.com" },
    expect.anything(),
  );
});

test("remove asks for confirmation then removes the seat", () => {
  asAdmin();
  renderAt();
  fireEvent.click(screen.getByRole("button", { name: "Remove two@x.com" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }),
  );
  expect(m.removeUser).toHaveBeenCalledWith(
    { seat: { seat: "2", email: "two@x.com" }, ownerEmail: "own@x.com" },
    expect.anything(),
  );
});

test("clinic without owner shows No owner set; legacy entry shows a dash seat", () => {
  asAdmin();
  m.clinics = [{ id: "c1", name: "Sunrise", createdAt: 1 }];
  m.emails = [{ email: "old@x.com", clinicId: "c1", seat: "", addedAt: 0 }];
  renderAt();
  expect(screen.getByText("No owner set")).toBeInTheDocument();
  expect(screen.getByText("Seat —")).toBeInTheDocument();
});

test("adds a user with the clinic's current seats", () => {
  asAdmin();
  renderAt();
  fireEvent.change(screen.getByLabelText("Add user to Sunrise"), {
    target: { value: "New@X.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to Sunrise" }));
  expect(m.addUser).toHaveBeenCalledWith(
    {
      email: "new@x.com",
      addedBy: "smartin.cherian@gmail.com",
      seats: [
        { seat: "1", email: "own@x.com" },
        { seat: "2", email: "two@x.com" },
      ],
    },
    expect.anything(),
  );
});

test("blocks adding an email that belongs to another clinic", () => {
  asAdmin();
  m.clinics = [
    { id: "c1", name: "Sunrise", createdAt: 1, ownerEmail: "own@x.com" },
    { id: "c2", name: "Moonlight", createdAt: 2 },
  ];
  m.emails = [{ email: "own@x.com", clinicId: "c1", seat: "1", addedAt: 0 }];
  renderAt();
  fireEvent.change(screen.getByLabelText("Add user to Moonlight"), {
    target: { value: "own@x.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to Moonlight" }));
  expect(
    screen.getByText("Already assigned to Sunrise. Remove it there first."),
  ).toBeInTheDocument();
  expect(m.addUser).not.toHaveBeenCalled();
});
