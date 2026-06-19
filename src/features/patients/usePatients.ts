import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
} from "./patientsRepo";
import type { PatientFormValues } from "./patientSchema";

export function usePatients() {
  return useQuery({ queryKey: ["patients"], queryFn: listPatients });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => getPatient(id as string),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => createPatient(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => updatePatient(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients", id] });
    },
  });
}
