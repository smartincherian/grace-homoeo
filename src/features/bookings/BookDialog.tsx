import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  createFilterOptions,
} from "@mui/material";
import { bookingFormSchema, type BookingFormValues } from "./bookingSchema";
import { SlotTakenError, type PatientChoice } from "./bookingsRepo";
import { useBookAppointment, usePatientChoices } from "./useBookings";
import { useAuth } from "../auth/useAuth";
import { normalizeEmail } from "../../lib/access";
import { formatZonedDate, formatZonedTime } from "../../lib/zonedDates";
import { useToast } from "../../components/useToast";

interface Props {
  slot: { start: number; end: number };
  tz: string;
  onClose: () => void;
}

const DEFAULTS: BookingFormValues = {
  patientId: null,
  patientName: "",
  phone: "",
  serialNo: null,
  note: "",
};

const digits = (s: string) => s.replace(/\D/g, "");

/** Name, `#serial` / serial digits and phone digits all find a patient. */
const filterChoices = createFilterOptions<PatientChoice>({
  limit: 8,
  stringify: (p) => `${p.name} #${p.serialNo} ${digits(p.phone)}`,
});

export default function BookDialog({ slot, tz, onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const choices = usePatientChoices().data ?? [];
  const book = useBookAppointment();
  const time = formatZonedTime(slot.start, tz);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: DEFAULTS,
  });
  const patientId = watch("patientId");
  const picked = choices.find((c) => c.id === patientId) ?? null;

  const pick = (p: PatientChoice | null) => {
    setValue("patientId", p?.id ?? null);
    setValue("serialNo", p?.serialNo ?? null);
    if (p) {
      setValue("patientName", p.name, { shouldValidate: true });
      setValue("phone", p.phone, { shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await book.mutateAsync({
        slot,
        values,
        by: normalizeEmail(user?.email ?? ""),
        tz,
      });
      showToast(`Booked ${time}`, "success");
      onClose();
    } catch (err) {
      if (err instanceof SlotTakenError) {
        // The mutation refreshes the day either way, so the winner shows.
        showToast("Slot just taken", "error");
        onClose();
      } else {
        showToast("Could not book. Please try again.", "error");
      }
    }
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        Book {time} · {formatZonedDate(slot.start, tz)}
      </DialogTitle>
      <Box component="form" noValidate onSubmit={(e) => void onSubmit(e)}>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Controller
              control={control}
              name="patientName"
              render={({ field }) => (
                <Autocomplete<PatientChoice, false, false, true>
                  freeSolo
                  options={choices}
                  value={picked}
                  inputValue={field.value}
                  filterOptions={filterChoices}
                  getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  onChange={(_e, v) =>
                    pick(v && typeof v !== "string" ? v : null)
                  }
                  onInputChange={(_e, v, reason) => {
                    if (reason !== "input") return;
                    field.onChange(v);
                    // Typing a different name unlinks the picked patient.
                    if (picked && v !== picked.name) pick(null);
                  }}
                  renderOption={({ key, ...props }, o) => (
                    <Box component="li" key={key} {...props}>
                      <Box>
                        <Box sx={{ fontWeight: 600 }}>{o.name}</Box>
                        <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                          #{o.serialNo}
                          {o.phone && ` · ${o.phone}`}
                        </Box>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Patient name"
                      onBlur={field.onBlur}
                      error={!!errors.patientName}
                      helperText={
                        errors.patientName?.message ??
                        "Search by name, #serial or phone, or type a new name"
                      }
                    />
                  )}
                />
              )}
            />
            <TextField
              label="Phone"
              type="tel"
              inputProps={{ inputMode: "tel" }}
              {...register("phone")}
              error={!!errors.phone}
              helperText={errors.phone?.message}
              fullWidth
            />
            <TextField
              label="Note"
              {...register("note")}
              error={!!errors.note}
              helperText={errors.note?.message}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || book.isPending}
          >
            Book
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
