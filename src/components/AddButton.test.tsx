import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AddButton from "./AddButton";

test("renders a labeled link to the target route", () => {
  render(
    <MemoryRouter>
      <AddButton label="Add patient" to="/patients/new" />
    </MemoryRouter>,
  );
  const link = screen.getByRole("link", { name: /add patient/i });
  expect(link).toHaveAttribute("href", "/patients/new");
});
