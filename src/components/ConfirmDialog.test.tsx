import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "./ConfirmDialog";

test("confirm fires onConfirm; cancel fires onClose", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Delete item?"
      message="Cannot be undone."
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  await user.click(screen.getByRole("button", { name: /delete/i }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
