import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("firebase/auth", () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock("../lib/firebase", () => ({ auth: {} }));
vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "doc@example.com" }, loading: false }),
}));

import AppShell from "./AppShell";

test("renders navigation to all three modules", () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/patients"]}>
        <AppShell />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByRole("link", { name: /patients/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /inventory/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /funds/i })).toBeInTheDocument();
});

test("account menu signs the user out", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><AppShell><div /></AppShell></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledTimes(1);
});
