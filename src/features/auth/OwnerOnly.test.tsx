import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import type { Membership } from "../../lib/access";

const state = vi.hoisted(() => ({
  membership: undefined as Membership | undefined,
}));
vi.mock("./AuthGuard", () => ({ useMembership: () => state.membership }));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import OwnerOnly from "./OwnerOnly";

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/c1/people"]}>
      <Routes>
        <Route
          path="/:clinicSlug/people"
          element={
            <OwnerOnly>
              <div>secret</div>
            </OwnerOnly>
          }
        />
        <Route
          path="/:clinicSlug/patients"
          element={<div>patients page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );

it("renders children for the owner", () => {
  state.membership = { superadmin: false, clinicId: "c1", owner: true };
  renderAt();
  expect(screen.getByText("secret")).toBeInTheDocument();
});

it("redirects a plain member to the clinic patients page", () => {
  state.membership = { superadmin: false, clinicId: "c1", owner: false };
  renderAt();
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
  expect(screen.getByText("patients page")).toBeInTheDocument();
});

it("waits instead of redirecting while membership is unresolved", () => {
  state.membership = undefined;
  renderAt();
  expect(screen.queryByText("patients page")).toBeNull();
  expect(screen.queryByText("secret")).toBeNull();
});
