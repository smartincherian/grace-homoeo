import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAllowedEmails, removeUnassignedEntry } from "./accessRepo";

export function useAllowedEmails() {
  return useQuery({
    queryKey: ["allowedEmails"],
    queryFn: listAllowedEmails,
  });
}

export function useRemoveUnassigned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => removeUnassignedEntry(email),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}
