import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RowMenu from "./RowMenu";

test("opens menu and fires edit/delete without triggering row click", async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onRowClick = vi.fn();
  render(
    <div onClick={onRowClick}>
      <RowMenu label="Arnica" onEdit={onEdit} onDelete={onDelete} />
    </div>,
  );
  await user.click(screen.getByRole("button", { name: /actions for arnica/i }));
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onRowClick).not.toHaveBeenCalled();
});
