import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { z } from "zod";
import { clinicDoc, getActiveClinic } from "./clinic";
import { functions } from "./firebase";
import { notifyWriteDenied } from "./writeDenied";

export const aiStatusSchema = z.preprocess(
  (v) => (v && typeof v === "object" ? v : {}),
  z.object({
    provider: z.literal("gemini").catch("gemini"),
    configured: z.boolean().catch(false),
    last4: z.string().catch(""),
    model: z.string().catch(""),
    updatedAt: z.number().catch(0),
    updatedBy: z.string().catch(""),
  }),
);
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const patientSummarySchema = z.object({
  bullets: z.array(z.string()),
  generatedAt: z.number(),
  generatedBy: z.string(),
  generatedByName: z.string(),
  model: z.string(),
  consultationCount: z.number(),
  lastConsultationAt: z.number().nullable(),
});
export type PatientSummary = z.infer<typeof patientSummarySchema>;

const GENERIC = "Something went wrong, try again.";

export function aiErrorMessage(err: unknown): string {
  if (
    err instanceof Error &&
    typeof (err as { code?: unknown }).code === "string" &&
    err.message
  ) {
    return err.message;
  }
  return GENERIC;
}

function notifyIfTrialEnded(err: unknown): void {
  const details = (err as { details?: { reason?: string } } | null)?.details;
  if (details?.reason === "trial-ended") notifyWriteDenied();
}

export function useAiStatus(
  clinicId: string | undefined,
): UseQueryResult<AiStatus> {
  return useQuery({
    queryKey: ["aiStatus", clinicId],
    queryFn: async () => {
      const snap = await getDoc(clinicDoc("settings", "ai", clinicId as string));
      return aiStatusSchema.parse(snap.exists() ? snap.data() : undefined);
    },
    enabled: !!clinicId,
  });
}

export function useSaveAiKey(
  clinicId: string,
): UseMutationResult<AiStatus, Error, string> {
  const qc = useQueryClient();
  const m = useMutation<AiStatus, Error, string>({
    // gcTime 0 drops the mutation from the cache once unobserved; the effect
    // below resets it on settle so the key never lingers in `variables`.
    // Read the outcome from the callbacks passed to `mutate`.
    gcTime: 0,
    mutationFn: async (apiKey: string) => {
      const res = await httpsCallable(functions, "saveAiKey")({ clinicId, apiKey });
      return aiStatusSchema.parse(res.data);
    },
    onSuccess: (s) => qc.setQueryData(["aiStatus", clinicId], s),
    onError: notifyIfTrialEnded,
  });
  const { isSuccess, isError, reset } = m;
  useEffect(() => {
    if (isSuccess || isError) reset();
  }, [isSuccess, isError, reset]);
  return m;
}

export function useRemoveAiKey(
  clinicId: string,
): UseMutationResult<AiStatus, Error, void> {
  const qc = useQueryClient();
  return useMutation<AiStatus, Error, void>({
    mutationFn: async () => {
      const res = await httpsCallable(functions, "removeAiKey")({ clinicId });
      return aiStatusSchema.parse(res.data);
    },
    onSuccess: (s) => qc.setQueryData(["aiStatus", clinicId], s),
    onError: notifyIfTrialEnded,
  });
}

export function usePatientSummary(
  patientId: string | undefined,
): UseQueryResult<PatientSummary | null> {
  const clinic = getActiveClinic();
  return useQuery({
    queryKey: ["patientSummary", clinic, patientId],
    queryFn: async () => {
      const snap = await getDoc(
        clinicDoc("patientSummaries", patientId as string, clinic),
      );
      return snap.exists() ? patientSummarySchema.parse(snap.data()) : null;
    },
    enabled: !!patientId,
  });
}

export function useSummarizePatient(
  patientId: string,
): UseMutationResult<PatientSummary, Error, void> {
  const qc = useQueryClient();
  const clinic = getActiveClinic();
  return useMutation<PatientSummary, Error, void>({
    mutationFn: async () => {
      const res = await httpsCallable(
        functions,
        "summarizePatient",
      )({ clinicId: clinic, patientId });
      return patientSummarySchema.parse(res.data);
    },
    onSuccess: (s) => qc.setQueryData(["patientSummary", clinic, patientId], s),
    onError: notifyIfTrialEnded,
  });
}
