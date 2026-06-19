import { render, screen } from "@testing-library/react";
import QueryStates from "./QueryStates";

test("shows spinner when pending", () => {
  render(
    <QueryStates status="pending" isEmpty={false} emptyMessage="none">
      <div>x</div>
    </QueryStates>,
  );
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

test("shows empty message when empty", () => {
  render(
    <QueryStates status="success" isEmpty emptyMessage="No patients yet">
      <div>x</div>
    </QueryStates>,
  );
  expect(screen.getByText("No patients yet")).toBeInTheDocument();
});

test("renders children on success with data", () => {
  render(
    <QueryStates status="success" isEmpty={false} emptyMessage="none">
      <div>content</div>
    </QueryStates>,
  );
  expect(screen.getByText("content")).toBeInTheDocument();
});

test("shows error message when status is error", () => {
  render(
    <QueryStates status="error" isEmpty={false} emptyMessage="none">
      <div>x</div>
    </QueryStates>,
  );
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
