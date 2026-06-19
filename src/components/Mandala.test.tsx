import { render } from "@testing-library/react";
import Mandala from "./Mandala";

test("renders a decorative svg that is hidden from assistive tech", () => {
  const { container } = render(<Mandala size={120} />);
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute("aria-hidden", "true");
});
