import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastProvider";

function Trigger() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("Saved!", "success")}>go</button>;
}

test("shows a toast message when triggered", async () => {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await userEvent.click(screen.getByText("go"));
  expect(await screen.findByText("Saved!")).toBeInTheDocument();
});
