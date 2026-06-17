import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";
import App from "../App";

test("redirects to patients placeholder", () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByText("Patients (coming soon)")).toBeInTheDocument();
});
