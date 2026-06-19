import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConsultation,
  getConsultation,
  listConsultationsByPatient,
  updateConsultation,
} from "./consultationsRepo";
import type {
  ConsultationFormValues,
  ConsultationPatientRef,
} from "./consultationSchema";

export function useConsultations(patientId: string | undefined) {
  return useQuery({
    queryKey: ["consultations", patientId],
    queryFn: () => listConsultationsByPatient(patientId as string),
    enabled: !!patientId,
  });
}

export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ["consultations", "one", id],
    queryFn: () => getConsultation(id as string),
    enabled: !!id,
  });
}

export function useCreateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      patient: ConsultationPatientRef;
      values: ConsultationFormValues;
    }) => createConsultation(vars.patient, vars.values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients", patientId] });
    },
  });
}

export function useUpdateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; values: ConsultationFormValues }) =>
      updateConsultation(vars.id, vars.values),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({
        queryKey: ["consultations", "one", vars.id],
      });
    },
  });
}
