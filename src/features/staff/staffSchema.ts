import { z } from "zod";

export const LEAVE_TYPES = ["Casual", "Sick", "Unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const PAYMENT_MODES = ["Cash", "UPI", "Bank"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const staffFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    phone: z.string().trim().default(""),
    designation: z.string().trim().default(""),
    joinedOn: z
      .number({
        required_error: "Joining date is required",
        invalid_type_error: "Joining date is required",
      })
      .int("Joining date is required"),
    leftOn: z.number().int().nullable().default(null),
    monthlySalary: z
      .number({ invalid_type_error: "Salary must be a number" })
      .nonnegative("Salary cannot be negative"),
  })
  .refine((v) => v.leftOn === null || v.leftOn >= v.joinedOn, {
    message: "Leaving date can't be before joining date",
    path: ["leftOn"],
  });

export type StaffFormValues = z.infer<typeof staffFormSchema>;

export interface Staff extends StaffFormValues {
  id: string;
  nameLower: string;
  active: boolean;
  createdAt: number;
}

export const leaveFormSchema = z
  .object({
    staffId: z.string().min(1),
    staffName: z.string(),
    from: z.number().int(),
    to: z.number().int(),
    halfDay: z.boolean().default(false),
    type: z.enum(LEAVE_TYPES),
    note: z.string().trim().default(""),
  })
  .refine((v) => v.to >= v.from, {
    message: "End date can't be before start date",
    path: ["to"],
  })
  .refine((v) => !v.halfDay || v.from === v.to, {
    message: "Half day only for a single day",
    path: ["halfDay"],
  });

export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

export interface Leave extends LeaveFormValues {
  id: string;
  createdAt: number;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
  base: number;
  paidDays: number;
  unpaidDays: number;
  deduction: number;
  adjustment: number;
  adjustmentNote: string;
  net: number;
  paidOn: number;
  paymentMode: PaymentMode;
  needsReview: boolean;
}

export function paymentId(staffId: string, month: string): string {
  return `${staffId}_${month}`;
}
