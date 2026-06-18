import { z } from "zod";

export const PAYMENT_MODES = ["Cash", "UPI", "No Fees", "Debt"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const consultationFormSchema = z.object({
  date: z.number({
    required_error: "Date is required",
    invalid_type_error: "Date is required",
  }).int().nonnegative(),
  complaint: z.string().trim().default(""),
  generals: z.string().trim().default(""),
  allergy: z.string().trim().default(""),
  history: z.string().trim().default(""),
  remedy: z.string().trim().default(""),
  remarks: z.string().trim().default(""),
  amount: z.number({ invalid_type_error: "Amount must be a number" }).nonnegative("Amount cannot be negative"),
  paymentMode: z.enum(PAYMENT_MODES, { required_error: "Payment mode is required" }),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export interface Consultation extends ConsultationFormValues {
  id: string;
  patientId: string;
  patientName: string;
  serialNo: number;
  createdAt: number;
}

export type ConsultationPatientRef = { id: string; name: string; serialNo: number };
