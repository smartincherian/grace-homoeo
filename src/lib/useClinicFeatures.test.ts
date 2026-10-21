import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const useClinic = vi.fn();
vi.mock("./clinicQueries", () => ({
  useClinic: (id: string | undefined) => useClinic(id),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ clinicSlug: "c1" }),
}));

import { useClinicFeatures } from "./useClinicFeatures";

describe("useClinicFeatures", () => {
  it("uses homoeo while the clinic is loading", () => {
    useClinic.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useClinicFeatures());
    expect(result.current.type).toBe("homoeo");
    expect(useClinic).toHaveBeenCalledWith("c1");
  });

  it("follows the clinic's type", () => {
    useClinic.mockReturnValue({ data: { type: "general" } });
    const { result } = renderHook(() => useClinicFeatures());
    expect(result.current.lsmc).toBe(false);
  });
});
