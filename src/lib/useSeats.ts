import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addUser, listSeats, removeUser, setOwner, type Seat } from "./seats";

export function useSeats(clinicId: string) {
  return useQuery({
    queryKey: ["seats", clinicId],
    queryFn: () => listSeats(clinicId),
    enabled: !!clinicId,
  });
}

function useInvalidate(clinicId?: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({
      queryKey: clinicId ? ["seats", clinicId] : ["seats"],
    });
    void qc.invalidateQueries({ queryKey: ["allowedEmails"] });
    void qc.invalidateQueries({ queryKey: ["clinics"] });
  };
}

export function useAddUser(clinicId: string) {
  const invalidate = useInvalidate(clinicId);
  return useMutation({
    mutationFn: ({
      email,
      addedBy,
      seats,
    }: {
      email: string;
      addedBy: string;
      seats: Seat[];
    }) => addUser(clinicId, email, addedBy, seats),
    onSuccess: invalidate,
  });
}

export function useRemoveUser(clinicId: string) {
  const invalidate = useInvalidate(clinicId);
  return useMutation({
    mutationFn: ({
      seat,
      ownerEmail,
    }: {
      seat: Seat;
      ownerEmail: string | undefined;
    }) => removeUser(clinicId, seat, ownerEmail),
    onSuccess: invalidate,
  });
}

export function useSetOwner() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ clinicId, email }: { clinicId: string; email: string }) =>
      setOwner(clinicId, email),
    onSuccess: invalidate,
  });
}
