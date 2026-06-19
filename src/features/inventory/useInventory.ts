import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createItem,
  deleteItem,
  getItem,
  listInventory,
  setQuantity,
  updateItem,
} from "./inventoryRepo";
import type { InventoryFormValues } from "./inventorySchema";

export function useInventory() {
  return useQuery({ queryKey: ["inventory"], queryFn: listInventory });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory", id],
    queryFn: () => getItem(id as string),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: InventoryFormValues) => createItem(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: InventoryFormValues) => updateItem(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["inventory", id] });
    },
  });
}

export function useSetQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; quantity: number }) =>
      setQuantity(vars.id, vars.quantity),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
