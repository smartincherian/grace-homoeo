import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  LEAVE_TYPES,
  leaveFormSchema,
  type LeaveFormValues,
} from "./staffSchema";
import { LeaveOverlapError } from "./staffRepo";
import { useSaveLeave, useStaffLeaves, useStaffMember } from "./useStaff";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import { dateInputToZonedMs, zonedMsToDateInput } from "../../lib/zonedDates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { useClinicPath } from "../auth/useClinicPath";

export default function LeaveFormPage() {
  const cp = useClinicPath();
  const { clinicSlug, id, leaveId } = useParams<{
    clinicSlug: string;
    id: string;
    leaveId: string;
  }>();
  const isEdit = !!leaveId;
  useSetPageTitle(isEdit ? "Edit leave" : "Add leave");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const tz = useClinicTimeZone(clinicSlug);
  const { data: staff } = useStaffMember(id);
  const { data: leaves } = useStaffLeaves(id);
  const save = useSaveLeave(tz);
  const [overlap, setOverlap] = useState(false);

  const previous = isEdit ? leaves?.find((l) => l.id === leaveId) : undefined;

  const {
    control,
    handleSubmit,
    reset,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      staffId: id ?? "",
      staffName: "",
      halfDay: false,
      type: "Casual",
      note: "",
    },
  });

  useEffect(() => {
    if (previous) {
      reset({
        staffId: previous.staffId,
        staffName: previous.staffName,
        from: previous.from,
        to: previous.to,
        halfDay: previous.halfDay,
        type: previous.type,
        note: previous.note,
      });
    }
  }, [previous, reset]);

  const from = watch("from");
  const to = watch("to");
  const sameDay = from !== undefined && from === to;

  // Don't allow saving an edit before the record (and its staff) has loaded.
  const ready = !!staff && (!isEdit || !!previous);

  const onSubmit = handleSubmit(async (values) => {
    if (!staff) return;
    setOverlap(false);
    try {
      await save.mutateAsync({
        values: { ...values, staffId: staff.id, staffName: staff.name },
        previous,
      });
      showToast("Leave saved", "success");
      navigate(cp(`/staff/${id}`));
    } catch (e) {
      if (e instanceof LeaveOverlapError) setOverlap(true);
      else showToast("Could not save leave. Please try again.", "error");
    }
  });

  const dateField = (name: "from" | "to", label: string, error?: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          label={label}
          type="date"
          fullWidth
          required
          InputLabelProps={{ shrink: true }}
          value={field.value ? zonedMsToDateInput(field.value, tz) : ""}
          onChange={(e) => {
            const ms = e.target.value
              ? dateInputToZonedMs(e.target.value, tz)
              : undefined;
            field.onChange(ms);
            setOverlap(false);
            // A half day only makes sense for a single day.
            const other = watch(name === "from" ? "to" : "from");
            if (ms === undefined || ms !== other) setValue("halfDay", false);
          }}
          error={!!error}
          helperText={error}
        />
      )}
    />
  );

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
            {isEdit ? "Edit leave" : "Add leave"}
            {staff ? ` — ${staff.name}` : ""}
          </Typography>
          <Stack spacing={2}>
            {dateField(
              "from",
              "From",
              overlap
                ? "This overlaps another leave"
                : errors.from
                  ? "Start date is required"
                  : undefined,
            )}
            {dateField(
              "to",
              "To",
              errors.to
                ? errors.to.type === "custom"
                  ? errors.to.message
                  : "End date is required"
                : undefined,
            )}
            <Controller
              name="halfDay"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  label="Half day"
                  control={
                    <Checkbox
                      checked={field.value}
                      disabled={!sameDay}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                />
              )}
            />
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <TextField select label="Type" fullWidth {...field}>
                  {LEAVE_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField label="Note" fullWidth {...register("note")} />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => navigate(-1)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={save.isPending || !ready}
              >
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
