// src/features/consultations/ConsultationFormPage.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  consultationFormSchema,
  PAYMENT_MODES,
  type ConsultationFormValues,
} from "./consultationSchema";
import {
  useConsultation,
  useConsultations,
  useCreateConsultation,
  useUpdateConsultation,
} from "./useConsultations";
import {
  EMPTY_GENERALS,
  generalsSchema,
  lsmcRowSchema,
  type Generals,
  type LsmcRowInput,
} from "./caseRecordSchema";
import { priorRecords } from "./caseRecordRepo";
import {
  useConsultationGenerals,
  useConsultationLsmc,
  usePatientGenerals,
  usePatientLsmc,
} from "./useCaseRecord";
import LsmcSummary from "./LsmcSummary";
import GeneralsFormSection from "./GeneralsFormSection";
import LsmcEditor from "./LsmcEditor";
import { usePatient } from "../patients/usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import AvatarTile from "../../components/AvatarTile";
import { CAPTION_SX, CARD_SX, LINE, PILL_SX, TOKENS } from "../../theme/theme";

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

// Secondary notes, laid out two per row under the prescription.
const TEXT_FIELDS: { name: keyof ConsultationFormValues; label: string }[] = [
  { name: "testsRequired", label: "Tests required" },
  { name: "differentialRemedy", label: "Differential remedy" },
  { name: "followupCriteria", label: "Followup criteria" },
  { name: "remarks", label: "Remarks" },
];

function SectionHeading({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        mb: 1.25,
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{children}</Typography>
      {action}
    </Box>
  );
}

function PillButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        ...PILL_SX,
        px: 1.5,
        py: 0.625,
        fontWeight: 700,
        color: TOKENS.blue700,
        bgcolor: TOKENS.blue50,
        "&:hover": { bgcolor: TOKENS.blue100 },
      }}
    >
      {children}
    </ButtonBase>
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
  const { data: allVisits } = useConsultations(patientId);
  const patientGenerals = usePatientGenerals(patientId);
  const visitGenerals = useConsultationGenerals(cid);
  const visitLsmc = useConsultationLsmc(cid);
  const patientLsmc = usePatientLsmc(patientId);
  const create = useCreateConsultation(patientId ?? "");
  const update = useUpdateConsultation(patientId ?? "");

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...DEFAULTS, date: Date.now() } as FormValues,
  });

  const loaded = useRef(false);
  // LSMC ids as loaded into the form; rows missing on save get deleted, so a
  // later refetch must not add ids the doctor never saw.
  const loadedLsmcIds = useRef<string[]>([]);
  // Editing waits for this visit's own case record, so a failed or pending
  // load can't blank (and so delete) what was stored. New visits start empty.
  const [ready, setReady] = useState(!isEdit);
  const caseRecordError = visitGenerals.isError || visitLsmc.isError;

  // Edit: load the consultation together with its case record.
  useEffect(() => {
    if (
      loaded.current ||
      caseRecordError ||
      !existing ||
      visitGenerals.isPending ||
      visitLsmc.isPending
    ) {
      return;
    }
    loaded.current = true;
    setReady(true);
    loadedLsmcIds.current = (visitLsmc.data ?? []).map((r) => r.id);
    const own = visitGenerals.data;
    reset({
      generals: own ? generalsSchema.parse(own) : EMPTY_GENERALS,
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
    caseRecordError,
    visitGenerals.isPending,
    visitGenerals.data,
    visitLsmc.isPending,
    visitLsmc.data,
    reset,
  ]);

  const onSubmit = handleSubmit(async ({ generals, lsmc, ...values }) => {
    // Blank generals: nothing stored for a new visit; deleted on edit.
    const record = { generals, lsmc };
    try {
      if (isEdit && cid) {
        await update.mutateAsync({
          id: cid,
          values,
          record,
          existingLsmcIds: loadedLsmcIds.current,
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
  // The visit being edited, so history shows only visits before it.
  const visit = existing && cid ? { id: cid, date: existing.date } : undefined;
  const earlierLsmc = priorRecords(patientLsmc.data ?? [], visit);
  // Newest earlier visit, for the reference panel and the copy shortcuts.
  const earlier = (allVisits ?? []).filter(
    (c) => c.id !== cid && (!existing || c.date <= existing.date),
  );
  const lastVisit = earlier[0];
  const lastLsmcId = lastVisit?.id ?? earlierLsmc[0]?.consultationId;
  const lastLsmc = earlierLsmc.filter((r) => r.consultationId === lastLsmcId);

  const copyLastLsmc = () =>
    setValue(
      "lsmc",
      [
        ...getValues("lsmc"),
        ...lastLsmc.map(({ location, sensation, modality, concomitant }) => ({
          location,
          sensation,
          modality,
          concomitant,
        })),
      ],
      { shouldDirty: true },
    );
  const repeatLastPrescription = () =>
    lastVisit && setValue("remedy", lastVisit.remedy, { shouldDirty: true });

  const canSave = !busy && ready && !caseRecordError;
  const visitDate = watch("date");

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      noValidate
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSave) {
          e.preventDefault();
          void onSubmit();
        }
      }}
    >
      <Box
        sx={{
          ...CARD_SX,
          px: { xs: 2, sm: 3.5 },
          py: 2,
          mb: 2.5,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        {patient && <AvatarTile name={patient.name} size={40} solid />}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h1" noWrap sx={{ fontSize: 17 }}>
            {isEdit ? "Edit consultation" : "New consultation"}
            {patient ? ` · ${patient.name}` : ""}
          </Typography>
          <Typography noWrap sx={{ fontSize: 13, color: "text.secondary" }}>
            {patient ? `#${patient.serialNo} · ` : ""}
            {visitDate ? dayjs(visitDate).format("ddd D MMM YYYY") : "No date"}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
          disabled={busy}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          Close
        </Button>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "340px 1fr" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box
          sx={{
            ...CARD_SX,
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            position: { md: "sticky" },
            top: { md: 28 },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontSize: 15, fontWeight: 800 }}>
              Last visit
            </Typography>
            {lastVisit && (
              <Box
                component="span"
                sx={{
                  ...PILL_SX,
                  bgcolor: TOKENS.ground,
                  color: "text.secondary",
                }}
              >
                {dayjs(lastVisit.date).format("D MMM YYYY")}
              </Box>
            )}
          </Box>
          {!lastVisit && lastLsmc.length === 0 && (
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              First visit — nothing recorded before.
            </Typography>
          )}
          {lastVisit?.complaint && (
            <Typography
              sx={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}
            >
              {lastVisit.complaint}
            </Typography>
          )}
          {lastVisit?.diagnosis && (
            <Box
              component="span"
              sx={{
                alignSelf: "flex-start",
                fontSize: 12,
                fontWeight: 600,
                px: 1.25,
                py: 0.625,
                borderRadius: "8px",
                bgcolor: TOKENS.ground,
              }}
            >
              {lastVisit.diagnosis}
            </Box>
          )}
          <LsmcSummary rows={lastLsmc} variant="lines" />
          {lastVisit?.remedy && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={CAPTION_SX}>Prescribed</Typography>
              <Box
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderRadius: "12px",
                  bgcolor: TOKENS.blue50,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: TOKENS.blue700,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {lastVisit.remedy}
                </Typography>
              </Box>
            </Box>
          )}
          {earlier.length > 0 && (
            <Typography
              component={Link}
              to={`/patients/${patientId}`}
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: TOKENS.blue700,
                textDecoration: "none",
              }}
            >
              View all {earlier.length} earlier visit
              {earlier.length === 1 ? "" : "s"} →
            </Typography>
          )}
        </Box>

        <Box sx={{ ...CARD_SX, minWidth: 0, overflow: "hidden" }}>
          <Box
            sx={{
              p: { xs: 2, sm: 3.5 },
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", sm: "1.2fr 1fr 1fr" },
                gap: 1.5,
              }}
            >
              <Box sx={{ gridColumn: { xs: "1 / -1", sm: "auto" } }}>
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
              </Box>
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
            </Box>

            <TextField
              label="Complaint"
              fullWidth
              multiline
              minRows={3}
              autoFocus={!isEdit}
              {...register("complaint")}
            />

            <Box>
              <SectionHeading
                action={
                  lastLsmc.length > 0 && (
                    <PillButton onClick={copyLastLsmc}>
                      Copy from last visit
                    </PillButton>
                  )
                }
              >
                LSMC
              </SectionHeading>
              <LsmcEditor control={control} register={register} />
            </Box>

            <TextField
              label="Diagnosis"
              fullWidth
              multiline
              {...register("diagnosis")}
            />

            <Box>
              <SectionHeading
                action={
                  lastVisit?.remedy && (
                    <PillButton onClick={repeatLastPrescription}>
                      Repeat last prescription
                    </PillButton>
                  )
                }
              >
                Prescription
              </SectionHeading>
              <TextField
                label="Prescription"
                fullWidth
                multiline
                minRows={2}
                helperText="Medicine with dosage"
                {...register("remedy")}
              />
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              {TEXT_FIELDS.map((f) => (
                <TextField
                  key={f.name}
                  label={f.label}
                  fullWidth
                  multiline
                  {...register(f.name)}
                />
              ))}
            </Box>

            {caseRecordError && (
              <Alert severity="error">
                Couldn't load generals or LSMC for this patient. Reload the page
                before saving, so existing records aren't overwritten.
              </Alert>
            )}

            <Box>
              <SectionHeading>Generals</SectionHeading>
              <GeneralsFormSection
                control={control}
                register={register}
                showMenstrual={patient?.gender === "Female"}
                history={priorRecords(patientGenerals.data ?? [], visit)}
              />
            </Box>
          </Box>

          <Box
            sx={{
              position: "sticky",
              // Just above the pinned scripture bar (and the tab bar on phones).
              bottom: {
                xs: "calc(80px + var(--scripture-h, 0px) + env(safe-area-inset-bottom))",
                md: "calc(24px + var(--scripture-h, 0px))",
              },
              bgcolor: TOKENS.white,
              borderTop: LINE,
              boxShadow: "0 -8px 24px rgba(20,26,46,.05)",
              px: { xs: 2, sm: 3.5 },
              py: 1.75,
              display: "flex",
              alignItems: "center",
              gap: 1.25,
            }}
          >
            <Typography
              sx={{
                fontSize: 13,
                color: "text.secondary",
                display: { xs: "none", sm: "block" },
              }}
            >
              Ctrl + Enter to save
            </Typography>
            <Button
              onClick={() => navigate(-1)}
              disabled={busy}
              sx={{ ml: "auto", height: 46 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canSave}
              sx={{ height: 46, px: 3 }}
            >
              {busy
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Save consultation"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
