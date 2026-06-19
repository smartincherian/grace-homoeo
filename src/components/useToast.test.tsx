import { render } from "@testing-library/react";
import { useToast } from "./useToast";

test("useToast throws when used outside ToastProvider", () => {
  const Bad = () => {
    useToast();
    return null;
  };
  // suppress React's error boundary console noise
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Bad />)).toThrow(/useToast must be used within/i);
  spy.mockRestore();
});
