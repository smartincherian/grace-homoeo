import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { theme } from "../theme/theme";
import App from "../App";

vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { uid: "test-uid", email: "doc@example.com" },
    loading: false,
  }),
}));
vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));
vi.mock("../lib/firebase", () => ({ auth: {} }));
vi.mock("../lib/access", async (orig) => ({
  ...(await orig<typeof import("../lib/access")>()),
  hasAccess: () => Promise.resolve(true),
}));
vi.mock("../features/patients/usePatients", () => ({
  usePatients: () => ({ status: "success", data: [] }),
}));

test("redirects to patients list", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "Patients" }),
  ).toBeInTheDocument();
});
