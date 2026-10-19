import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClinic, listClinics } from "./clinicsRepo";

export function useClinics() {
  return useQuery({ queryKey: ["clinics"], queryFn: listClinics });
}

export function useCreateClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => createClinic(id, name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinics"] });
    },
  });
}
