import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();
const deleteDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "orderItems" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "doc-ref" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import {
  createOrderItem,
  deleteOrderItem,
  listOrderItems,
  markOrdered,
} from "./orderRepo";

beforeEach(() => {
  addDoc.mockReset();
  getDocs.mockReset();
  updateDoc.mockReset();
  deleteDoc.mockReset();
});

describe("createOrderItem", () => {
  it("writes nameLower, ordered=false and createdAt", async () => {
    addDoc.mockResolvedValue({ id: "new-id" });
    const id = await createOrderItem({
      category: "medicine",
      name: "Arnica",
      variant: "200",
      quantity: "2",
    });
    expect(id).toBe("new-id");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("arnica");
    expect(payload.ordered).toBe(false);
    expect(typeof payload.createdAt).toBe("number");
  });
});

describe("listOrderItems", () => {
  it("maps docs and defaults missing fields", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "o1",
          data: () => ({ category: "bottles", variant: "1 dram", createdAt: 5 }),
        },
      ],
    });
    expect(await listOrderItems()).toEqual([
      {
        id: "o1",
        category: "bottles",
        name: "",
        nameLower: "",
        variant: "1 dram",
        quantity: "",
        ordered: false,
        createdAt: 5,
      },
    ]);
    expect(orderBy).toHaveBeenCalledWith("createdAt");
  });
});

describe("markOrdered", () => {
  it("flags the entry as ordered instead of deleting it", async () => {
    updateDoc.mockResolvedValue(undefined);
    await markOrdered("o1");
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.ordered).toBe(true);
    expect(typeof payload.orderedAt).toBe("number");
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});

describe("deleteOrderItem", () => {
  it("deletes the entry", async () => {
    deleteDoc.mockResolvedValue(undefined);
    await deleteOrderItem("o1");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});
