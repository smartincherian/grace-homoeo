import { useQuery } from "@tanstack/react-query";
import {
  getConsultationGenerals,
  listLsmcByConsultation,
  listLsmcByPatient,
  listPatientGenerals,
} from "./caseRecordRepo";

/** All generals snapshots for the patient, newest first. */
export function usePatientGenerals(patientId: string | undefined) {
  return useQuery({
    queryKey: ["generals", patientId],
    queryFn: () => listPatientGenerals(patientId as string),
    enabled: !!patientId,
  });
}

export function useConsultationGenerals(cid: string | undefined) {
  return useQuery({
    queryKey: ["generals", "visit", cid],
    queryFn: () => getConsultationGenerals(cid as string),
    enabled: !!cid,
  });
}

export function usePatientLsmc(patientId: string | undefined) {
  return useQuery({
    queryKey: ["lsmc", patientId],
    queryFn: () => listLsmcByPatient(patientId as string),
    enabled: !!patientId,
  });
}

export function useConsultationLsmc(cid: string | undefined) {
  return useQuery({
    queryKey: ["lsmc", "visit", cid],
    queryFn: () => listLsmcByConsultation(cid as string),
    enabled: !!cid,
  });
}
