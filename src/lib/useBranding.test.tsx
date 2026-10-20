import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const getBranding = vi.fn();
const saveBranding = vi.fn();
vi.mock("./branding", async (orig) => ({
  ...(await orig<typeof import("./branding")>()),
  getBranding: (...a: unknown[]) => getBranding(...a),
  saveBranding: (...a: unknown[]) => saveBranding(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { DEFAULT_BRANDING, readCachedBranding, writeCachedBranding } from "./branding";
import { useBranding, useSaveBranding } from "./useBranding";

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
vi.stubGlobal("localStorage", memoryStorage);

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  getBranding.mockReset();
  saveBranding.mockReset();
  localStorage.clear();
});

describe("useBranding", () => {
  it("returns cached data immediately, then the fetched value", async () => {
    writeCachedBranding("c1", { ...DEFAULT_BRANDING, displayName: "Cached" });
    const fresh = { ...DEFAULT_BRANDING, displayName: "Fresh" };
    getBranding.mockResolvedValue(fresh);
    const { wrapper } = wrap();
    const { result } = renderHook(() => useBranding("c1"), { wrapper });
    expect(result.current.data?.displayName).toBe("Cached");
    await waitFor(() => expect(result.current.data?.displayName).toBe("Fresh"));
    expect(readCachedBranding("c1")?.displayName).toBe("Fresh");
  });

  it("does not fetch without a clinic id", () => {
    const { wrapper } = wrap();
    renderHook(() => useBranding(undefined), { wrapper });
    expect(getBranding).not.toHaveBeenCalled();
  });
});

describe("useSaveBranding", () => {
  it("saves, updates the query cache and local cache", async () => {
    saveBranding.mockResolvedValue(undefined);
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useSaveBranding("c1"), { wrapper });
    const b = { ...DEFAULT_BRANDING, displayName: "New" };
    await result.current.mutateAsync({ branding: b, by: "o@x.com" });
    expect(saveBranding).toHaveBeenCalledWith("c1", b, "o@x.com");
    expect(qc.getQueryData(["branding", "c1"])).toEqual(b);
    expect(readCachedBranding("c1")).toEqual(b);
  });
});
