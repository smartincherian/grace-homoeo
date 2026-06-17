import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ToastProvider } from "./ToastProvider";
import { useToast } from "./useToast";

function Trigger() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("Saved!", "success")}>go</button>;
}

it("shows a toast message when triggered", async () => {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await userEvent.click(screen.getByText("go"));
  expect(await screen.findByText("Saved!")).toBeInTheDocument();
});
