import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: { user: null as { email: string } | null, loading: true },
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("../../lib/firebase", () => ({ db: {} }));
vi.mock("./useAllowedEmails", () => ({
  useAllowedEmails: () => ({ status: "success", data: [] }),
  useAddAllowedEmail: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveAllowedEmail: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("../../components/PageChrome", () => ({ useSetPageTitle: () => {} }));

import AccessPage from "./AccessPage";

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/access"]}>
      <Routes>
        <Route path="/access" element={<AccessPage />} />
        <Route path="/patients" element={<div>Patients page</div>} />
      </Routes>
    </MemoryRouter>,
  );

test("does not redirect while auth is still loading", () => {
  auth.value = { user: null, loading: true };
  renderAt();
  expect(screen.queryByText("Patients page")).not.toBeInTheDocument();
});

test("shows the page to the superadmin", () => {
  auth.value = { user: { email: "smartin.cherian@gmail.com" }, loading: false };
  renderAt();
  expect(screen.getByRole("heading", { name: "Manage access" })).toBeInTheDocument();
});

test("redirects other users to patients", () => {
  auth.value = { user: { email: "doc@clinic.com" }, loading: false };
  renderAt();
  expect(screen.getByText("Patients page")).toBeInTheDocument();
});
