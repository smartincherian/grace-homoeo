import { z } from "zod";

export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDERS)[number];

export const patientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  // Optional: not always known when registering (e.g. from a booking).
  dob: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((v) => v ?? null),
  gender: z.enum(GENDERS, { required_error: "Gender is required" }),
  place: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export interface Patient extends PatientFormValues {
  id: string;
  serialNo: number;
  nameLower: string;
  createdAt: number;
  lastVisitAt: number | null;
}
