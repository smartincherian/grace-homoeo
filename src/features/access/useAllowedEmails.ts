import { useQuery } from "@tanstack/react-query";
import { listAllowedEmails } from "./accessRepo";

export function useAllowedEmails() {
  return useQuery({
    queryKey: ["allowedEmails"],
    queryFn: listAllowedEmails,
  });
}
