import { render, screen } from "@testing-library/react";
import BottomDock from "./BottomDock";

test("footer shows without scripture", () => {
  render(<BottomDock showScripture={false} />);
  expect(screen.getByText(/developed by/i)).toBeInTheDocument();
  expect(screen.queryByLabelText("Scripture")).not.toBeInTheDocument();
});

test("shows scripture and footer together", () => {
  render(<BottomDock showScripture />);
  expect(screen.getByLabelText("Scripture")).toBeInTheDocument();
  expect(screen.getByText(/developed by/i)).toBeInTheDocument();
});
