import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrderItem,
  deleteOrderItem,
  listOrderItems,
  markOrdered,
} from "./orderRepo";
import type { OrderFormValues } from "./orderSchema";

const KEY = ["orderItems"];

export function useOrderItems() {
  return useQuery({ queryKey: KEY, queryFn: listOrderItems });
}

export function useCreateOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: OrderFormValues) => createOrderItem(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useMarkOrdered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markOrdered(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOrderItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
