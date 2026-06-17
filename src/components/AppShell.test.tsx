import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";
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
