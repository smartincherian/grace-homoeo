import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("firebase/auth", () => ({
  signOut: (...a: unknown[]) => signOut(...a),
}));
vi.mock("../lib/firebase", () => ({ auth: {} }));
vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "doc@example.com" }, loading: false }),
}));

import AppShell from "./AppShell";
import { useSetPageTitle } from "./PageChrome";

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
  render(
    <MemoryRouter>
      <AppShell>
        <div />
      </AppShell>
    </MemoryRouter>,
  );
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledTimes(1);
});

function TitleSetter() {
  useSetPageTitle("Patient details");
  return <div>page body</div>;
}

test("shows a back button on a non-root route and navigates back on click", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter
        initialEntries={["/patients", "/patients/p1"]}
        initialIndex={1}
      >
        <AppShell>
          <TitleSetter />
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  const back = screen.getByRole("button", { name: /back/i });
  expect(back).toBeInTheDocument();
  await user.click(back);
});

test("hides the back button on a root tab", () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/patients"]}>
        <AppShell>
          <div />
        </AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(
    screen.queryByRole("button", { name: /back/i }),
  ).not.toBeInTheDocument();
});
