// src/features/inventory/useInventory.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./inventoryRepo", () => ({
  listInventory: vi.fn().mockResolvedValue([{ id: "i1", name: "Arnica" }]),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  setQuantity: vi.fn(),
  deleteItem: vi.fn(),
}));

import { useInventory } from "./useInventory";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useInventory", () => {
  it("returns the inventory list from the repository", async () => {
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "i1", name: "Arnica" }]);
  });
});
