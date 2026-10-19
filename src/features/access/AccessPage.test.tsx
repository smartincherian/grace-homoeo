import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: { user: null as { email: string } | null, loading: true },
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../../lib/firebase", () => ({ db: {} }));
const m = vi.hoisted(() => ({
  addEmail: vi.fn(),
  createClinic: vi.fn(),
  toast: vi.fn(),
  emails: [] as { email: string; clinicId: string; addedAt: number }[],
}));
vi.mock("./useClinics", () => ({
  useClinics: () => ({
    status: "success",
    data: [{ id: "c1", name: "Sunrise", createdAt: 1 }],
  }),
  useCreateClinic: () => ({ mutate: m.createClinic, isPending: false }),
}));
vi.mock("./useAllowedEmails", () => ({
  useAllowedEmails: () => ({ status: "success", data: m.emails }),
  useAddAllowedEmail: () => ({ mutate: m.addEmail, isPending: false }),
  useRemoveAllowedEmail: () => ({ mutate: vi.fn(), isPending: false }),
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
  m.addEmail.mockReset();
  m.createClinic.mockReset();
  m.emails = [];
};

test("slug auto-fills from name and create is called", () => {
  asAdmin();
  renderAt();
  fireEvent.change(screen.getByLabelText("Clinic name"), {
    target: { value: "Sunrise Homoeo" },
  });
  expect(screen.getByLabelText("Slug")).toHaveValue("sunrise-homoeo");
  fireEvent.click(screen.getByRole("button", { name: "Create clinic" }));
  expect(m.createClinic).toHaveBeenCalledWith(
    { id: "sunrise-homoeo", name: "Sunrise Homoeo" },
    expect.anything(),
  );
});

test("invalid slug disables create and shows helper text", () => {
  asAdmin();
  renderAt();
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "Bad Slug" } });
  expect(screen.getByRole("button", { name: "Create clinic" })).toBeDisabled();
  expect(
    screen.getByText("Lowercase letters, numbers and hyphens (3–40)"),
  ).toBeInTheDocument();
});

test("allowing an email requires a clinic", () => {
  asAdmin();
  renderAt();
  fireEvent.change(screen.getByLabelText("Email to allow"), {
    target: { value: "a@x.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Allow" }));
  expect(screen.getByText("Choose a clinic")).toBeInTheDocument();
  expect(m.addEmail).not.toHaveBeenCalled();

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Clinic" }));
  fireEvent.click(within(screen.getByRole("listbox")).getByText("Sunrise"));
  fireEvent.click(screen.getByRole("button", { name: "Allow" }));
  expect(m.addEmail).toHaveBeenCalledWith(
    { email: "a@x.com", clinicId: "c1", addedBy: "smartin.cherian@gmail.com" },
    expect.anything(),
  );
});

test("lists clinic name or No clinic for allowed emails", () => {
  asAdmin();
  m.emails = [
    { email: "a@x.com", clinicId: "c1", addedAt: 0 },
    { email: "b@x.com", clinicId: "", addedAt: 0 },
  ];
  renderAt();
  expect(screen.getByText("No clinic")).toBeInTheDocument();
  expect(screen.getAllByText("Sunrise").length).toBeGreaterThan(0);
});
