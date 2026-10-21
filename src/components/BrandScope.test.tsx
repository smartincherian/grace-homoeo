import { vi } from "vitest";
import { render } from "@testing-library/react";
import { DEFAULT_BRAND, ensureContrast } from "../theme/brand";

const useBranding = vi.hoisted(() => vi.fn());
vi.mock("../lib/useBranding", () => ({
  useBranding: (id: string | undefined) => useBranding(id),
}));
const useClinic = vi.hoisted(() => vi.fn());
vi.mock("../lib/clinicQueries", () => ({
  useClinic: (id: string | undefined) => useClinic(id),
}));

import BrandScope from "./BrandScope";

const root = () => document.documentElement.style.getPropertyValue("--brand");

beforeEach(() => {
  useBranding.mockReturnValue({
    data: { displayName: "Teal Clinic", primaryColor: "#0f766e" },
  });
  useClinic.mockReturnValue({ data: { name: "One" } });
});

test("applies the clinic colour and title, then restores defaults", () => {
  const { rerender } = render(
    <BrandScope clinicId="c1">
      <p>x</p>
    </BrandScope>,
  );
  expect(root()).toBe(ensureContrast("#0f766e"));
  expect(document.title).toBe("Teal Clinic · Homoeo Desk");
  useBranding.mockReturnValue({ data: undefined });
  rerender(
    <BrandScope clinicId={undefined}>
      <p>x</p>
    </BrandScope>,
  );
  expect(root()).toBe(ensureContrast(DEFAULT_BRAND));
  expect(document.title).toBe("Homoeo Desk");
});

test("falls back to the clinic name when the display name is empty", () => {
  useBranding.mockReturnValue({
    data: { displayName: "", primaryColor: "#0f766e" },
  });
  render(
    <BrandScope clinicId="c1">
      <p>x</p>
    </BrandScope>,
  );
  expect(document.title).toBe("One · Homoeo Desk");
});

test("restores defaults on unmount", () => {
  const { unmount } = render(
    <BrandScope clinicId="c1">
      <p>x</p>
    </BrandScope>,
  );
  unmount();
  expect(root()).toBe(ensureContrast(DEFAULT_BRAND));
  expect(document.title).toBe("Homoeo Desk");
});

test("switching clinics updates the colour", () => {
  const { rerender } = render(
    <BrandScope clinicId="a">
      <p>x</p>
    </BrandScope>,
  );
  useBranding.mockReturnValue({
    data: { displayName: "Red", primaryColor: "#b91c1c" },
  });
  rerender(
    <BrandScope clinicId="b">
      <p>x</p>
    </BrandScope>,
  );
  expect(root()).toBe(ensureContrast("#b91c1c"));
  expect(document.title).toBe("Red · Homoeo Desk");
});
