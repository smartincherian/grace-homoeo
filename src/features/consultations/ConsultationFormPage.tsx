// src/features/consultations/ConsultationFormPage.tsx
import { useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
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
import {
  EMPTY_GENERALS,
  GENERALS_KEYS,
  generalsEqual,
  generalsSchema,
  lsmcRowSchema,
  toBaseline,
  type Generals,
  type LsmcRowInput,
} from "./caseRecordSchema";
import { latestGenerals, latestGeneralsBefore } from "./caseRecordRepo";
import {
  useConsultationGenerals,
  useConsultationLsmc,
  usePatientGenerals,
} from "./useCaseRecord";
import GeneralsFormSection from "./GeneralsFormSection";
import LsmcEditor from "./LsmcEditor";
import { usePatient } from "../patients/usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";

const formSchema = consultationFormSchema.extend({
  generals: generalsSchema,
  lsmc: z.array(lsmcRowSchema),
});

type FormValues = ConsultationFormValues & {
  generals: Generals;
  lsmc: LsmcRowInput[];
};

const DEFAULTS: Partial<FormValues> = {
  complaint: "",
  diagnosis: "",
  testsRequired: "",
  remedy: "",
  differentialRemedy: "",
  followupCriteria: "",
  remarks: "",
  amount: 0,
  paymentMode: "Cash",
  generals: EMPTY_GENERALS,
  lsmc: [],
};

const TEXT_FIELDS: {
  name: keyof ConsultationFormValues;
  label: string;
  helper?: string;
}[] = [
  { name: "complaint", label: "Complaint" },
  { name: "diagnosis", label: "Diagnosis" },
  { name: "testsRequired", label: "Tests required" },
  { name: "remedy", label: "Prescription", helper: "Medicine with dosage" },
  { name: "differentialRemedy", label: "Differential remedy" },
  { name: "followupCriteria", label: "Followup criteria" },
  { name: "remarks", label: "Remarks" },
];

function SectionHeading({ children }: { children: string }) {
  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="h6">{children}</Typography>
      <Divider />
    </Box>
  );
}

export default function ConsultationFormPage() {
  const { patientId, cid } = useParams<{ patientId: string; cid: string }>();
  const isEdit = !!cid;
  useSetPageTitle(isEdit ? "Edit consultation" : "Add consultation");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: patient } = usePatient(patientId);
  const { data: existing } = useConsultation(cid);
  const patientGenerals = usePatientGenerals(patientId);
  const visitGenerals = useConsultationGenerals(cid);
  const visitLsmc = useConsultationLsmc(cid);
  const create = useCreateConsultation(patientId ?? "");
  const update = useUpdateConsultation(patientId ?? "");

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...DEFAULTS, date: Date.now() } as FormValues,
  });

  // Generals are saved for a visit only when they differ from what was
  // pre-filled (the baseline), unless the visit already has its own record.
  const baseline = useRef<Generals>(EMPTY_GENERALS);
  const hasOwnGenerals = useRef(false);
  const loaded = useRef(false);

  // New visit: pre-fill from the patient's latest generals (LMP excluded),
  // without touching fields the doctor has already typed into.
  const dirtyGenerals = dirtyFields.generals as
    | Partial<Record<keyof Generals, boolean>>
    | undefined;
  useEffect(() => {
    if (isEdit || loaded.current || !patientGenerals.data) return;
    loaded.current = true;
    baseline.current = toBaseline(latestGenerals(patientGenerals.data));
    for (const k of GENERALS_KEYS) {
      if (!dirtyGenerals?.[k]) {
        setValue(`generals.${k}`, baseline.current[k] as never);
      }
    }
  }, [isEdit, patientGenerals.data, dirtyGenerals, setValue]);

  // Edit: load the consultation together with its case record.
  useEffect(() => {
    if (
      loaded.current ||
      !existing ||
      visitGenerals.isPending ||
      visitLsmc.isPending ||
      patientGenerals.isPending
    ) {
      return;
    }
    loaded.current = true;
    const own = visitGenerals.data ?? null;
    hasOwnGenerals.current = !!own;
    baseline.current = own
      ? generalsSchema.parse(own)
      : toBaseline(
          latestGeneralsBefore(patientGenerals.data ?? [], existing.date),
        );
    reset({
      generals: baseline.current,
      lsmc: (visitLsmc.data ?? []).map((r) => ({
        id: r.id,
        location: r.location,
        sensation: r.sensation,
        modality: r.modality,
        concomitant: r.concomitant,
      })),
      date: existing.date,
      complaint: existing.complaint,
      diagnosis: existing.diagnosis,
      testsRequired: existing.testsRequired,
      remedy: existing.remedy,
      differentialRemedy: existing.differentialRemedy,
      followupCriteria: existing.followupCriteria,
      remarks: existing.remarks,
      amount: existing.amount,
      paymentMode: existing.paymentMode,
    });
  }, [
    existing,
    visitGenerals.isPending,
    visitGenerals.data,
    visitLsmc.isPending,
    visitLsmc.data,
    patientGenerals.isPending,
    patientGenerals.data,
    reset,
  ]);

  const onSubmit = handleSubmit(async ({ generals, lsmc, ...values }) => {
    const record = {
      generals:
        hasOwnGenerals.current || !generalsEqual(generals, baseline.current)
          ? generals
          : null,
      lsmc,
    };
    try {
      if (isEdit && cid) {
        await update.mutateAsync({
          id: cid,
          values,
          record,
          existingLsmcIds: (visitLsmc.data ?? []).map((r) => r.id),
        });
        showToast("Consultation updated", "success");
      } else if (patient) {
        await create.mutateAsync({
          patient: {
            id: patient.id,
            name: patient.name,
            serialNo: patient.serialNo,
          },
          values,
          record,
        });
        showToast("Consultation added", "success");
      } else {
        return; // patient not loaded yet
      }
      navigate(
        isEdit
          ? `/patients/${patientId}/consultations/${cid}`
          : `/patients/${patientId}`,
      );
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
                helperText={f.helper}
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

            <SectionHeading>Generals</SectionHeading>
            <GeneralsFormSection
              control={control}
              register={register}
              showMenstrual={patient?.gender === "Female"}
            />

            <SectionHeading>LSMC</SectionHeading>
            <LsmcEditor control={control} register={register} />

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
