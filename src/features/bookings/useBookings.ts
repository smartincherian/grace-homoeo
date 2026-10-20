import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Appointment } from "../../lib/appointments";
import type { BookingFormValues } from "./bookingSchema";
import {
  bookAppointment,
  closeAppointment,
  listDayHistory,
  listPatientChoices,
  markArrived,
} from "./bookingsRepo";

export function useDayHistory(clinicId: string, dayStart: number) {
  return useQuery({
    queryKey: ["appointments", "history", clinicId, dayStart],
    queryFn: () => listDayHistory(clinicId, dayStart),
    enabled: !!clinicId,
  });
}

export function usePatientChoices() {
  return useQuery({
    queryKey: ["bookings", "patientChoices"],
    queryFn: listPatientChoices,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["appointments"] });
}

export function useBookAppointment() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      slot: { start: number; end: number };
      values: BookingFormValues;
      by: string;
      tz: string;
    }) => bookAppointment(v.slot, v.values, v.by, v.tz),
    // Also refresh on failure so a "slot just taken" day view shows the winner.
    onSettled: done,
  });
}

export function useCloseAppointment() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      appointment: Appointment;
      status: "cancelled" | "no-show";
      by: string;
    }) => closeAppointment(v.appointment, v.status, v.by),
    onSuccess: done,
  });
}

export function useMarkArrived() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => markArrived(id),
    onSuccess: done,
  });
}
