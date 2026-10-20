import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaff,
  deleteLeave,
  deletePayment,
  getStaff,
  listLeavesForMonth,
  listLeavesForStaff,
  listPaymentsForMonth,
  listPaymentsForStaff,
  listStaff,
  markPaid,
  saveLeave,
  updateStaff,
} from "./staffRepo";
import type {
  Leave,
  LeaveFormValues,
  SalaryPayment,
  StaffFormValues,
} from "./staffSchema";

export function useStaffList() {
  return useQuery({ queryKey: ["staff", "list"], queryFn: listStaff });
}

export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: ["staff", "one", id],
    queryFn: () => getStaff(id as string),
    enabled: !!id,
  });
}

export function useStaffLeaves(staffId: string | undefined) {
  return useQuery({
    queryKey: ["staff", "leaves", staffId],
    queryFn: () => listLeavesForStaff(staffId as string),
    enabled: !!staffId,
  });
}

export function useMonthLeaves(month: string, tz: string) {
  return useQuery({
    queryKey: ["staff", "monthLeaves", month, tz],
    queryFn: () => listLeavesForMonth(month, tz),
  });
}

export function useStaffPayments(staffId: string | undefined) {
  return useQuery({
    queryKey: ["staff", "payments", staffId],
    queryFn: () => listPaymentsForStaff(staffId as string),
    enabled: !!staffId,
  });
}

export function useMonthPayments(month: string) {
  return useQuery({
    queryKey: ["staff", "monthPayments", month],
    queryFn: () => listPaymentsForMonth(month),
  });
}

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => {
    for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
  };
}

export function useCreateStaff() {
  const done = useInvalidate(["staff"]);
  return useMutation({
    mutationFn: (v: StaffFormValues) => createStaff(v),
    onSuccess: done,
  });
}

export function useUpdateStaff(id: string) {
  const done = useInvalidate(["staff"]);
  return useMutation({
    mutationFn: (v: StaffFormValues) => updateStaff(id, v),
    onSuccess: done,
  });
}

export function useSaveLeave(tz: string) {
  const done = useInvalidate(["staff", "funds"]);
  return useMutation({
    mutationFn: (a: { values: LeaveFormValues; previous?: Leave }) =>
      saveLeave(a.values, tz, a.previous),
    onSuccess: done,
  });
}

export function useDeleteLeave(tz: string) {
  const done = useInvalidate(["staff", "funds"]);
  return useMutation({
    mutationFn: (leave: Leave) => deleteLeave(leave, tz),
    onSuccess: done,
  });
}

export function useMarkPaid() {
  const done = useInvalidate(["staff", "funds"]);
  return useMutation({
    mutationFn: (p: Omit<SalaryPayment, "id" | "needsReview">) => markPaid(p),
    onSuccess: done,
  });
}

export function useDeletePayment() {
  const done = useInvalidate(["staff", "funds"]);
  return useMutation({
    mutationFn: (a: { staffId: string; month: string }) =>
      deletePayment(a.staffId, a.month),
    onSuccess: done,
  });
}
