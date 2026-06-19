// src/features/consultations/ConsultationFormPage.tsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  consultationFormSchema,
  PAYMENT_MODES,
  type ConsultationFormValues,
} from "./consultationSchema";
import {
  useConsultation,
  useCreateConsultation,
  useUpdateConsultation,
} from "./useConsultations";
import { usePatient } from "../patients/usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";

const DEFAULTS: Partial<ConsultationFormValues> = {
  complaint: "",
  generals: "",
  allergy: "",
  history: "",
  remedy: "",
  remarks: "",
  amount: 0,
  paymentMode: "Cash",
};

const TEXT_FIELDS: { name: keyof ConsultationFormValues; label: string }[] = [
  { name: "complaint", label: "Complaint" },
  { name: "generals", label: "Generals" },
  { name: "allergy", label: "Allergy" },
  { name: "history", label: "History" },
  { name: "remedy", label: "Remedy" },
  { name: "remarks", label: "Remarks" },
];

export default function ConsultationFormPage() {
  const { patientId, cid } = useParams<{ patientId: string; cid: string }>();
  const isEdit = !!cid;
  useSetPageTitle(isEdit ? "Edit consultation" : "Add consultation");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: patient } = usePatient(patientId);
  const { data: existing } = useConsultation(cid);
  const create = useCreateConsultation(patientId ?? "");
  const update = useUpdateConsultation(patientId ?? "");

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: { ...DEFAULTS, date: Date.now() } as ConsultationFormValues,
  });

  useEffect(() => {
    if (existing) {
      reset({
        date: existing.date,
        complaint: existing.complaint,
        generals: existing.generals,
        allergy: existing.allergy,
        history: existing.history,
        remedy: existing.remedy,
        remarks: existing.remarks,
        amount: existing.amount,
        paymentMode: existing.paymentMode,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && cid) {
        await update.mutateAsync({ id: cid, values });
        showToast("Consultation updated", "success");
      } else if (patient) {
        await create.mutateAsync({
          patient: {
            id: patient.id,
            name: patient.name,
            serialNo: patient.serialNo,
          },
          values,
        });
        showToast("Consultation added", "success");
      } else {
        return; // patient not loaded yet
      }
      navigate(`/patients/${patientId}`);
    } catch {
      showToast("Could not save consultation. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      noValidate
      sx={{ maxWidth: 560, mx: "auto" }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {isEdit ? "Edit consultation" : "Add consultation"}
          </Typography>
          {patient && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {patient.name} · #{patient.serialNo}
            </Typography>
          )}
          <Stack spacing={2}>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  value={field.value ? msToDateInput(field.value) : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        ? dateInputToMs(e.target.value)
                        : undefined,
                    )
                  }
                  error={!!errors.date}
                  helperText={errors.date?.message}
                />
              )}
            />

            {TEXT_FIELDS.map((f) => (
              <TextField
                key={f.name}
                label={f.label}
                fullWidth
                multiline
                minRows={1}
                {...register(f.name)}
              />
            ))}

            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Amount (₹)"
                  type="number"
                  fullWidth
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                />
              )}
            />

            <Controller
              name="paymentMode"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Payment mode"
                  select
                  fullWidth
                  required
                  {...field}
                  error={!!errors.paymentMode}
                  helperText={errors.paymentMode?.message}
                >
                  {PAYMENT_MODES.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => navigate(-1)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
