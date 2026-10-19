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
import type { CaseRecordInput } from "./caseRecordSchema";
import type { QueryClient } from "@tanstack/react-query";

function invalidateCaseRecord(qc: QueryClient, patientId: string, cid: string) {
  void qc.invalidateQueries({ queryKey: ["generals", patientId] });
  void qc.invalidateQueries({ queryKey: ["generals", "visit", cid] });
  void qc.invalidateQueries({ queryKey: ["lsmc", patientId] });
  void qc.invalidateQueries({ queryKey: ["lsmc", "visit", cid] });
}

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
      record: CaseRecordInput;
    }) => createConsultation(vars.patient, vars.values, vars.record),
    onSuccess: (cid) => {
      invalidateCaseRecord(qc, patientId, cid);
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients", patientId] });
    },
  });
}

export function useUpdateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      values: ConsultationFormValues;
      record: CaseRecordInput;
      existingLsmcIds: string[];
    }) =>
      updateConsultation(
        vars.id,
        patientId,
        vars.values,
        vars.record,
        vars.existingLsmcIds,
      ),
    onSuccess: (_data, vars) => {
      invalidateCaseRecord(qc, patientId, vars.id);
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({
        queryKey: ["consultations", "one", vars.id],
      });
    },
  });
}
