import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  getMembership: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  signOut: (...a: unknown[]) => h.signOut(...a),
}));
vi.mock("../../lib/firebase", () => ({ auth: {}, db: {} }));
vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "a@b.com" }, loading: false }),
}));
vi.mock("../../lib/access", () => ({
  getMembership: (...a: unknown[]) => h.getMembership(...a),
}));

import AuthGuard from "./AuthGuard";

const renderGuard = (qc: QueryClient) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <div>app</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it("signs out and redirects to /login when a previously valid membership resolves null", async () => {
  const qc = new QueryClient();
  h.getMembership.mockResolvedValueOnce({
    superadmin: false,
    clinicId: "c1",
    owner: false,
  });
  renderGuard(qc);
  expect(await screen.findByText("app")).toBeInTheDocument();

  h.getMembership.mockResolvedValueOnce(null);
  await qc.refetchQueries({ queryKey: ["access", "u1"] });

  expect(await screen.findByText("login page")).toBeInTheDocument();
  await waitFor(() => expect(h.signOut).toHaveBeenCalled());
});
