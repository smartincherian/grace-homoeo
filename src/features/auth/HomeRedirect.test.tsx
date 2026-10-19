import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import type { Membership } from "../../lib/access";

const state = vi.hoisted(() => ({
  membership: undefined as Membership | undefined,
}));
vi.mock("./AuthGuard", () => ({ useMembership: () => state.membership }));

import HomeRedirect from "./HomeRedirect";

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<Where />} />
        <Route path="/:clinicSlug/*" element={<Where />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/patients/*" element={<HomeRedirect />} />
        <Route path="/nonsense" element={<HomeRedirect />} />
      </Routes>
    </MemoryRouter>,
  );

const member: Membership = { superadmin: false, clinicId: "c1" };

test("forwards a legacy deep link into the member's clinic", () => {
  state.membership = member;
  renderAt("/patients/abc?x=1");
  expect(screen.getByTestId("where")).toHaveTextContent("/c1/patients/abc?x=1");
});

test("sends a member at the root to their clinic home", () => {
  state.membership = member;
  renderAt("/");
  expect(screen.getByTestId("where")).toHaveTextContent("/c1/patients");
});

test("sends a member on an unknown path to their clinic home", () => {
  state.membership = member;
  renderAt("/nonsense");
  expect(screen.getByTestId("where")).toHaveTextContent(/^\/c1\/patients$/);
});

test("sends the superadmin to admin", () => {
  state.membership = { superadmin: true, clinicId: null };
  renderAt("/");
  expect(screen.getByTestId("where")).toHaveTextContent(/^\/admin$/);
});
