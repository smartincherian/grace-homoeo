import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: { user: null as { email: string } | null, loading: true },
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../../lib/firebase", () => ({ db: {} }));
type Entry = {
  email: string;
  clinicId: string;
  seat: string;
  addedAt: number;
  active?: boolean;
};
const m = vi.hoisted(() => ({
  addUser: vi.fn(),
  removeUser: vi.fn(),
  setOwner: vi.fn(),
  removeUnassigned: vi.fn(),
  createClinic: vi.fn(),
  setClinicActive: vi.fn(),
  setClinicAuthorized: vi.fn(),
  setUserActive: vi.fn(),
  deleteClinic: vi.fn(),
  toast: vi.fn(),
  emails: [] as Entry[],
  clinics: [] as {
    id: string;
    name: string;
    createdAt: number;
    ownerEmail?: string;
    active?: boolean;
    authorized?: boolean;
    trialEndsAt?: number;
    selfSignup?: boolean;
  }[],
}));
vi.mock("./useClinics", () => ({
  useClinics: () => ({
    status: "success",
    data: m.clinics,
  }),
  useCreateClinic: () => ({ mutate: m.createClinic, isPending: false }),
  useSetClinicActive: () => ({ mutate: m.setClinicActive, isPending: false }),
  useSetClinicAuthorized: () => ({
    mutate: m.setClinicAuthorized,
    isPending: false,
  }),
  useSetUserActive: () => ({ mutate: m.setUserActive, isPending: false }),
  useDeleteClinic: () => ({ mutate: m.deleteClinic, isPending: false }),
}));
vi.mock("./useAllowedEmails", () => ({
  useAllowedEmails: () => ({
    status: "success",
    data: m.emails.map((e) => ({ ...e, active: e.active ?? true })),
  }),
  useRemoveUnassigned: () => ({ mutate: m.removeUnassigned, isPending: false }),
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
    m.setClinicActive,
    m.setClinicAuthorized,
    m.setUserActive,
    m.deleteClinic,
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

const expand = (name = "Sunrise") =>
  fireEvent.click(
    screen.getByRole("button", { name: `Show users of ${name}` }),
  );

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
      authorized: false,
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
  expand();
  expect(screen.getAllByText("own@x.com")).toHaveLength(2);
  // The column header and the owner chip.
  expect(screen.getAllByText("Owner")).toHaveLength(2);
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
  expand();
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
  expand();
  expect(screen.getByText("No seat (legacy)")).toBeInTheDocument();
});

test("adds a user with the clinic's current seats", () => {
  asAdmin();
  renderAt();
  expand();
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
  expand("Moonlight");
  fireEvent.change(screen.getByLabelText("Add user to Moonlight"), {
    target: { value: "own@x.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to Moonlight" }));
  expect(
    screen.getByText("Already assigned to Sunrise. Remove it there first."),
  ).toBeInTheDocument();
  expect(m.addUser).not.toHaveBeenCalled();
});

test("seat-less users cannot be removed or made owner", () => {
  asAdmin();
  m.emails = [
    { email: "own@x.com", clinicId: "c1", seat: "1", addedAt: 0 },
    { email: "old@x.com", clinicId: "c1", seat: "", addedAt: 0 },
  ];
  renderAt();
  expand();
  expect(
    screen.getByRole("button", { name: "Remove old@x.com" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Make old@x.com owner" }),
  ).toBeDisabled();
});

test("lists unassigned entries and removes one after confirmation", () => {
  asAdmin();
  m.emails = [
    { email: "own@x.com", clinicId: "c1", seat: "1", addedAt: 0 },
    { email: "orph@x.com", clinicId: "", seat: "", addedAt: 0 },
    { email: "ghost@x.com", clinicId: "gone", seat: "1", addedAt: 0 },
  ];
  renderAt();
  expect(
    screen.getByRole("heading", { name: "Unassigned" }),
  ).toBeInTheDocument();
  expect(screen.getByText("ghost@x.com")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove orph@x.com" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }),
  );
  expect(m.removeUnassigned).toHaveBeenCalledWith(
    "orph@x.com",
    expect.anything(),
  );
});

test("no Unassigned section when every entry has a clinic", () => {
  asAdmin();
  renderAt();
  expect(screen.queryByRole("heading", { name: "Unassigned" })).toBeNull();
});

test("adding an orphan email to a clinic points to Unassigned", () => {
  asAdmin();
  m.emails = [{ email: "orph@x.com", clinicId: "", seat: "", addedAt: 0 }];
  renderAt();
  expand();
  fireEvent.change(screen.getByLabelText("Add user to Sunrise"), {
    target: { value: "orph@x.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add to Sunrise" }));
  expect(
    screen.getByText(
      "Already in the allow list without a clinic. Remove it under Unassigned first.",
    ),
  ).toBeInTheDocument();
  expect(m.addUser).not.toHaveBeenCalled();
});

test("creating a clinic with an owner already in another clinic is blocked", () => {
  asAdmin();
  renderAt();
  fillCreate("Moon Clinic", "own@x.com");
  fireEvent.click(screen.getByRole("button", { name: "Create clinic" }));
  expect(
    screen.getByText("Already assigned to Sunrise. Remove it there first."),
  ).toBeInTheDocument();
  expect(m.createClinic).not.toHaveBeenCalled();
});

test("clinic rows show owner, user count and status; users stay hidden until expanded", () => {
  asAdmin();
  m.clinics.push({ id: "c2", name: "Moonlight", createdAt: 2, active: false });
  renderAt();
  const table = screen.getByRole("table", { name: "Clinics" });
  expect(within(table).getByText("2/3")).toBeInTheDocument();
  expect(within(table).getByText("0/3")).toBeInTheDocument();
  expect(within(table).getByText("Active")).toBeInTheDocument();
  expect(within(table).getByText("Inactive")).toBeInTheDocument();
  expect(screen.queryByText("Seat 2")).toBeNull();
  expand();
  expect(screen.getByText("Seat 2")).toBeInTheDocument();
});

test("making a clinic inactive asks first", () => {
  asAdmin();
  m.clinics.push({ id: "c2", name: "Moonlight", createdAt: 2, active: false });
  renderAt();
  fireEvent.click(screen.getByRole("button", { name: "Actions for Sunrise" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Make inactive" }));
  expect(m.setClinicActive).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Make inactive",
    }),
  );
  expect(m.setClinicActive).toHaveBeenCalledWith(
    { id: "c1", active: false },
    expect.anything(),
  );
});

test("making an inactive clinic active needs no confirmation", () => {
  asAdmin();
  m.clinics.push({ id: "c2", name: "Moonlight", createdAt: 2, active: false });
  renderAt();
  fireEvent.click(
    screen.getByRole("button", { name: "Actions for Moonlight" }),
  );
  fireEvent.click(screen.getByRole("menuitem", { name: "Make active" }));
  expect(m.setClinicActive).toHaveBeenLastCalledWith(
    { id: "c2", active: true },
    expect.anything(),
  );
});

test("a user can be made inactive and back, with an Inactive chip", () => {
  asAdmin();
  m.emails[1].active = false;
  renderAt();
  expand();
  expect(screen.getByText("Inactive")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Make own@x.com inactive" }),
  );
  expect(m.setUserActive).toHaveBeenCalledWith(
    { email: "own@x.com", active: false },
    expect.anything(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Make two@x.com active" }),
  );
  expect(m.setUserActive).toHaveBeenLastCalledWith(
    { email: "two@x.com", active: true },
    expect.anything(),
  );
});

test("deleting a clinic needs its slug typed", () => {
  asAdmin();
  renderAt();
  fireEvent.click(screen.getByRole("button", { name: "Actions for Sunrise" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete clinic" }));
  const dialog = screen.getByRole("dialog");
  const del = within(dialog).getByRole("button", { name: "Delete clinic" });
  expect(del).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Type c1 to confirm"), {
    target: { value: "Sunrise" },
  });
  expect(del).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText("Type c1 to confirm"), {
    target: { value: "c1" },
  });
  fireEvent.click(del);
  expect(m.deleteClinic).toHaveBeenCalledWith("c1", expect.anything());
});

const DAY = 86_400_000;

test("shows trial status chips and the self signup chip", () => {
  asAdmin();
  const now = Date.now();
  m.clinics = [
    { id: "a", name: "Aa", createdAt: 1, trialEndsAt: now - DAY },
    {
      id: "b",
      name: "Bb",
      createdAt: 1,
      trialEndsAt: now + 1.5 * DAY,
      selfSignup: true,
    },
    { id: "c", name: "Cc", createdAt: 1, authorized: true },
    { id: "d", name: "Dd", createdAt: 1 },
  ];
  renderAt();
  expect(screen.getByText("Trial ended")).toBeInTheDocument();
  expect(screen.getByText("Trial · 2 days left")).toBeInTheDocument();
  expect(screen.getByText("Authorized")).toBeInTheDocument();
  expect(screen.getByText("Legacy")).toBeInTheDocument();
  expect(screen.getByText("Self signup")).toBeInTheDocument();
});

test("authorizing a clinic asks first, then authorizes", () => {
  asAdmin();
  renderAt();
  fireEvent.click(screen.getByRole("button", { name: "Actions for Sunrise" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Authorize" }));
  expect(m.setClinicAuthorized).not.toHaveBeenCalled();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Authorize",
    }),
  );
  expect(m.setClinicAuthorized).toHaveBeenCalledWith(
    { clinic: expect.objectContaining({ id: "c1" }), authorized: true },
    expect.anything(),
  );
});

test("removing authorization from a legacy clinic warns it turns read-only", () => {
  asAdmin();
  m.clinics = [{ id: "c1", name: "Sunrise", createdAt: 1, authorized: true }];
  renderAt();
  fireEvent.click(screen.getByRole("button", { name: "Actions for Sunrise" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Remove authorization" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(
      /becomes read-only immediately/,
    ),
  ).toBeInTheDocument();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Remove authorization",
    }),
  );
  expect(m.setClinicAuthorized).toHaveBeenCalledWith(
    { clinic: expect.objectContaining({ id: "c1" }), authorized: false },
    expect.anything(),
  );
});

test("the create form can create an authorized clinic", () => {
  asAdmin();
  renderAt();
  fillCreate("Sunrise Homoeo", "dr@x.com");
  fireEvent.click(screen.getByLabelText("Authorized (no trial)"));
  fireEvent.click(screen.getByRole("button", { name: "Create clinic" }));
  expect(m.createClinic).toHaveBeenCalledWith(
    expect.objectContaining({ authorized: true }),
    expect.anything(),
  );
});
