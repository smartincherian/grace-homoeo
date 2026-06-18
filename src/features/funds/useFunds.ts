import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense, deleteExpense, getExpense, listExpenses, listIncome, updateExpense,
} from "./fundsRepo";
import type { ExpenseFormValues } from "./fundsSchema";

export function useIncome(startMs: number, endMs: number) {
  return useQuery({
    queryKey: ["funds", "income", startMs, endMs],
    queryFn: () => listIncome(startMs, endMs),
  });
}

export function useExpenses(startMs: number, endMs: number) {
  return useQuery({
    queryKey: ["funds", "expenses", startMs, endMs],
    queryFn: () => listExpenses(startMs, endMs),
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ["funds", "expenses", "one", id],
    queryFn: () => getExpense(id as string),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ExpenseFormValues) => createExpense(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["funds"] });
    },
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ExpenseFormValues) => updateExpense(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["funds"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["funds"] });
    },
  });
}
