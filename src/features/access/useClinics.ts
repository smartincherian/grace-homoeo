import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClinic, listClinics, setClinicAuthorized } from "./clinicsRepo";
import type { Clinic } from "../../lib/clinicQueries";
import {
  deleteClinic,
  setClinicActive,
  setUserActive,
} from "./clinicAdminRepo";

export function useClinics() {
  return useQuery({ queryKey: ["clinics"], queryFn: () => listClinics() });
}

export function useCreateClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      ownerEmail,
      addedBy,
      authorized,
    }: {
      id: string;
      name: string;
      ownerEmail: string;
      addedBy: string;
      authorized?: boolean;
    }) => createClinic(id, name, ownerEmail, addedBy, authorized),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinics"] });
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}

export function useSetClinicActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setClinicActive(id, active),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["clinics"] }),
  });
}

export function useSetClinicAuthorized() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clinic,
      authorized,
    }: {
      clinic: Clinic;
      authorized: boolean;
    }) => setClinicAuthorized(clinic, authorized),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["clinics"] }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, active }: { email: string; active: boolean }) =>
      setUserActive(email, active),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["allowedEmails"] }),
  });
}

/** Deletes a clinic and all its data; `onStep` names the collection being cleared. */
export function useDeleteClinic(onStep?: (step: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClinic(id, onStep),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["clinics"] });
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}
