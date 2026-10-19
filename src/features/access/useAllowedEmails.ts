import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAllowedEmail,
  listAllowedEmails,
  removeAllowedEmail,
} from "./accessRepo";

export function useAllowedEmails() {
  return useQuery({
    queryKey: ["allowedEmails"],
    queryFn: listAllowedEmails,
  });
}

export function useAddAllowedEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, addedBy }: { email: string; addedBy: string }) =>
      addAllowedEmail(email, addedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}

export function useRemoveAllowedEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => removeAllowedEmail(email),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    },
  });
}
