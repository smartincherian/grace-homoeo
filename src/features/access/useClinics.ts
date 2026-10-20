import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClinic, listClinics } from "./clinicsRepo";

export function useClinics() {
  return useQuery({ queryKey: ["clinics"], queryFn: listClinics });
}

export function useCreateClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      ownerEmail,
      addedBy,
    }: {
      id: string;
      name: string;
      ownerEmail: string;
      addedBy: string;
    }) => createClinic(id, name, ownerEmail, addedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinics"] });
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}
