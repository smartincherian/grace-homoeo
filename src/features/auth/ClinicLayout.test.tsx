import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import type { Membership } from "../../lib/access";

const state = vi.hoisted(() => ({
  membership: undefined as Membership | undefined,
  clinic: { data: undefined as unknown },
}));
vi.mock("./AuthGuard", () => ({ useMembership: () => state.membership }));
vi.mock("../../lib/clinicQueries", () => ({
  useClinic: () => state.clinic,
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import * as clinic from "../../lib/clinic";
import ClinicLayout from "./ClinicLayout";

let navigateTo: (to: string) => void = () => {};
function NavigateHook() {
  navigateTo = useNavigate();
  return null;
}

function Child() {
  return <div>child of {clinic.getActiveClinic()}</div>;
}

const renderAt = (path: string, qc = new QueryClient()) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <NavigateHook />
        <Routes>
          <Route path="/admin" element={<div>admin page</div>} />
          <Route path="/:clinicSlug" element={<ClinicLayout />}>
            <Route path="patients" element={<Child />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  clinic.setActiveClinic(null);
  state.clinic = { data: undefined };
});

test("bounces a member away from another clinic without activating it", () => {
  const spy = vi.spyOn(clinic, "setActiveClinic");
  state.membership = { superadmin: false, clinicId: "c1" };
  renderAt("/c2/patients");
  expect(screen.getByText("child of c1")).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalledWith("c2");
  spy.mockRestore();
});

test("renders the child for a member of the clinic and activates it", () => {
  state.membership = { superadmin: false, clinicId: "c1" };
  renderAt("/c1/patients");
  expect(screen.getByText("child of c1")).toBeInTheDocument();
  expect(clinic.getActiveClinic()).toBe("c1");
});

test("lets the superadmin into any clinic", () => {
  state.membership = { superadmin: true, clinicId: null };
  renderAt("/c2/patients");
  expect(screen.getByText("child of c2")).toBeInTheDocument();
});

test("tells the superadmin when a clinic does not exist", () => {
  state.membership = { superadmin: true, clinicId: null };
  state.clinic = { data: null };
  renderAt("/nope/patients");
  expect(screen.getByText(/clinic not found/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute(
    "href",
    "/admin",
  );
});

test("switching clinics clears clinic data but keeps access", async () => {
  state.membership = { superadmin: true, clinicId: null };
  const qc = new QueryClient();
  qc.setQueryData(["access", "uid1"], state.membership);
  qc.setQueryData(["patients"], [{ id: "p1" }]);
  renderAt("/c1/patients", qc);
  expect(screen.getByText("child of c1")).toBeInTheDocument();
  expect(qc.getQueryData(["patients"])).toBeDefined();

  act(() => navigateTo("/c2/patients"));

  expect(await screen.findByText("child of c2")).toBeInTheDocument();
  expect(qc.getQueryData(["patients"])).toBeUndefined();
  expect(qc.getQueryData(["access", "uid1"])).toEqual(state.membership);
});

test("forwards a reserved word like /patients to the member's clinic", () => {
  const spy = vi.spyOn(clinic, "setActiveClinic");
  state.membership = { superadmin: false, clinicId: "c1" };
  renderAt("/patients");
  expect(screen.getByText("child of c1")).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalledWith("patients");
  spy.mockRestore();
});

test("sends the superadmin at a reserved word like /access to admin", () => {
  const spy = vi.spyOn(clinic, "setActiveClinic");
  state.membership = { superadmin: true, clinicId: null };
  renderAt("/access");
  expect(screen.getByText("admin page")).toBeInTheDocument();
  expect(spy).not.toHaveBeenCalledWith("access");
  spy.mockRestore();
});
