// src/features/patients/PatientFormPage.tsx
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
  patientFormSchema,
  GENDERS,
  type PatientFormValues,
} from "./patientSchema";
import { usePatient, useCreatePatient, useUpdatePatient } from "./usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";

const DEFAULTS: Partial<PatientFormValues> = {
  name: "",
  gender: "Female",
  place: "",
  phone: "",
};

export default function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useSetPageTitle(isEdit ? "Edit patient" : "Add patient");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = usePatient(id);
  const create = useCreatePatient();
  const update = useUpdatePatient(id ?? "");

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: DEFAULTS as PatientFormValues,
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        dob: existing.dob,
        gender: existing.gender,
        place: existing.place,
        phone: existing.phone,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Patient updated", "success");
        navigate(`/patients/${id}`);
      } else {
        const newId = await create.mutateAsync(values);
        showToast("Patient added", "success");
        navigate(`/patients/${newId}`);
      }
    } catch {
      showToast("Could not save patient. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <Box
      component="form"
      noValidate
      onSubmit={onSubmit}
      sx={{ maxWidth: 480, mx: "auto" }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3 }}>
            {isEdit ? "Edit patient" : "Add patient"}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Name"
              fullWidth
              required
              {...register("name")}
              error={!!errors.name}
              helperText={errors.name?.message}
            />

            <Controller
              name="dob"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Date of birth"
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
                  error={!!errors.dob}
                  helperText={errors.dob?.message}
                />
              )}
            />

            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Gender"
                  select
                  fullWidth
                  required
                  {...field}
                  error={!!errors.gender}
                  helperText={errors.gender?.message}
                >
                  {GENDERS.map((g) => (
                    <MenuItem key={g} value={g}>
                      {g}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField label="Place" fullWidth {...register("place")} />
            <TextField label="Phone" fullWidth {...register("phone")} />

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
