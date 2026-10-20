import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { staffFormSchema, type StaffFormValues } from "./staffSchema";
import { useCreateStaff, useStaffMember, useUpdateStaff } from "./useStaff";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import { dateInputToZonedMs, zonedMsToDateInput } from "../../lib/zonedDates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { useClinicPath } from "../auth/useClinicPath";

const DEFAULTS: Partial<StaffFormValues> = {
  name: "",
  phone: "",
  designation: "",
  leftOn: null,
};

export default function StaffFormPage() {
  const cp = useClinicPath();
  const { clinicSlug, id } = useParams<{ clinicSlug: string; id: string }>();
  const isEdit = !!id;
  useSetPageTitle(isEdit ? "Edit staff" : "Add staff");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const tz = useClinicTimeZone(clinicSlug);
  const { data: existing } = useStaffMember(id);
  const create = useCreateStaff();
  const update = useUpdateStaff(id ?? "");

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: DEFAULTS as StaffFormValues,
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        phone: existing.phone,
        designation: existing.designation,
        joinedOn: existing.joinedOn,
        leftOn: existing.leftOn,
        monthlySalary: existing.monthlySalary,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const staffId = isEdit
        ? (await update.mutateAsync(values), id)
        : await create.mutateAsync(values);
      showToast("Staff saved", "success");
      navigate(cp(`/staff/${staffId}`));
    } catch {
      showToast("Could not save staff. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      noValidate
      sx={{ maxWidth: 480, mx: "auto" }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3 }}>
            {isEdit ? "Edit staff" : "Add staff"}
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
            <TextField label="Phone" fullWidth {...register("phone")} />
            <TextField
              label="Designation"
              fullWidth
              {...register("designation")}
            />
            <Controller
              name="joinedOn"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Joined on"
                  type="date"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  value={field.value ? zonedMsToDateInput(field.value, tz) : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        ? dateInputToZonedMs(e.target.value, tz)
                        : undefined,
                    )
                  }
                  error={!!errors.joinedOn}
                  helperText={errors.joinedOn?.message}
                />
              )}
            />
            <Controller
              name="leftOn"
              control={control}
              render={({ field }) => (
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label="Left on"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={
                      field.value !== null && field.value !== undefined
                        ? zonedMsToDateInput(field.value, tz)
                        : ""
                    }
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          ? dateInputToZonedMs(e.target.value, tz)
                          : null,
                      )
                    }
                    error={!!errors.leftOn}
                    helperText={errors.leftOn?.message ?? "Optional"}
                  />
                  {field.value !== null && field.value !== undefined && (
                    <Button
                      onClick={() => field.onChange(null)}
                      sx={{ mt: 1, flex: "none" }}
                    >
                      Clear
                    </Button>
                  )}
                </Stack>
              )}
            />
            <Controller
              name="monthlySalary"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Monthly salary (₹)"
                  type="number"
                  fullWidth
                  required
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                  error={!!errors.monthlySalary}
                  helperText={errors.monthlySalary?.message}
                />
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
