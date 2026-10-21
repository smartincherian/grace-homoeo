import { z } from "zod";

export const bookingFormSchema = z.object({
  patientId: z.string().nullable(),
  patientName: z.string().trim().min(1, "Name is required").max(80),
  // Optional, even for a new patient: it may not be available.
  phone: z.string().trim().max(20, "Phone is too long").default(""),
  serialNo: z.number().int().nullable(),
  note: z.string().trim().max(200, "Note is too long").default(""),
});

export type BookingFormValues = {
  patientId: string | null;
  patientName: string;
  phone: string;
  serialNo: number | null;
  note: string;
};
