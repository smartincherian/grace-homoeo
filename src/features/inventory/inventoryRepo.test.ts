import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const getDoc = vi.fn();
const updateDoc = vi.fn();
const deleteDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "inventory" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "doc-ref" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createItem, getItem, listInventory, updateItem, setQuantity, deleteItem } from "./inventoryRepo";

beforeEach(() => {
  addDoc.mockReset(); getDocs.mockReset(); getDoc.mockReset(); updateDoc.mockReset(); deleteDoc.mockReset();
});

describe("createItem", () => {
  it("writes derived nameLower and updatedAt", async () => {
    addDoc.mockResolvedValue({ id: "new-id" });
    const id = await createItem({ name: "Arnica 30", quantity: 5, unit: "vials", reorderLevel: 2, notes: "" });
    expect(id).toBe("new-id");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("arnica 30");
    expect(payload.quantity).toBe(5);
    expect(typeof payload.updatedAt).toBe("number");
  });
});

describe("listInventory", () => {
  it("maps Firestore docs to InventoryItem objects", async () => {
    getDocs.mockResolvedValue({
      docs: [{
        id: "i1",
        data: () => ({ name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9 }),
      }],
    });
    const list = await listInventory();
    expect(list).toEqual([{
      id: "i1", name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9,
    }]);
  });
});

describe("getItem", () => {
  it("maps an existing document to an InventoryItem", async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      id: "i1",
      data: () => ({ name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9 }),
    });
    const item = await getItem("i1");
    expect(item).toEqual({
      id: "i1", name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9,
    });
  });
  it("returns null when the document does not exist", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    const item = await getItem("missing");
    expect(item).toBeNull();
  });
});

describe("updateItem", () => {
  it("rewrites nameLower and updatedAt", async () => {
    updateDoc.mockResolvedValue(undefined);
    await updateItem("i1", { name: "New Name", quantity: 1, unit: "", reorderLevel: 0, notes: "" });
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("new name");
    expect(typeof payload.updatedAt).toBe("number");
  });
});

describe("setQuantity", () => {
  it("writes the new quantity and updatedAt only", async () => {
    updateDoc.mockResolvedValue(undefined);
    await setQuantity("i1", 8);
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.quantity).toBe(8);
    expect(typeof payload.updatedAt).toBe("number");
    expect(Object.keys(payload).sort()).toEqual(["quantity", "updatedAt"]);
  });
});

describe("deleteItem", () => {
  it("deletes the item document", async () => {
    deleteDoc.mockResolvedValue(undefined);
    await deleteItem("i1");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});
