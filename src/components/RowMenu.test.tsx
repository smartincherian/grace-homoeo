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

test("renders custom actions before Edit and fires them", async () => {
  const user = userEvent.setup();
  const onArrived = vi.fn();
  const onEdit = vi.fn();
  render(
    <RowMenu
      label="Asha"
      onEdit={onEdit}
      actions={[{ label: "Arrived", onClick: onArrived }]}
    />,
  );
  await user.click(screen.getByRole("button", { name: /actions for asha/i }));
  const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
  expect(items).toEqual(["Arrived", "Edit"]);
  await user.click(screen.getByRole("menuitem", { name: "Arrived" }));
  expect(onArrived).toHaveBeenCalledTimes(1);
  expect(onEdit).not.toHaveBeenCalled();
});

test("omits Edit when only actions are given", async () => {
  const user = userEvent.setup();
  render(
    <RowMenu label="Asha" actions={[{ label: "Cancel", onClick: vi.fn() }]} />,
  );
  await user.click(screen.getByRole("button", { name: /actions for asha/i }));
  expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
    "Cancel",
  ]);
});
