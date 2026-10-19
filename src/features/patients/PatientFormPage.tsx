// src/features/patients/PatientFormPage.tsx
import { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  ButtonBase,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  patientFormSchema,
  GENDERS,
  type PatientFormValues,
} from "./patientSchema";
import {
  usePatient,
  usePatients,
  useCreatePatient,
  useUpdatePatient,
} from "./usePatients";
import {
  calcAge,
  daysAgoLabel,
  msToDateInput,
  dateInputToMs,
} from "../../lib/dates";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import AvatarTile from "../../components/AvatarTile";
import { CARD_SX, LINE, PILL_SX, TOKENS } from "../../theme/theme";

const DEFAULTS: Partial<PatientFormValues> = {
  name: "",
  gender: "Female",
  place: "",
  phone: "",
};

const digits = (s: string) => s.replace(/\D/g, "");

export default function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useSetPageTitle(isEdit ? "Edit patient" : "Add patient");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = usePatient(id);
  const { data: allPatients } = usePatients();
  const create = useCreatePatient();
  const update = useUpdatePatient(id ?? "");
  // Which create button was pressed.
  const startConsultation = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    watch,
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

  const others = useMemo(
    () => (allPatients ?? []).filter((p) => p.id !== id),
    [allPatients, id],
  );
  // Most-used places, offered as one-tap suggestions.
  const places = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of others) {
      const place = p.place.trim();
      if (place) count.set(place, (count.get(place) ?? 0) + 1);
    }
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([place]) => place);
  }, [others]);
  const nextSerial = Math.max(0, ...others.map((p) => p.serialNo)) + 1;

  const phone = digits(watch("phone") ?? "");
  const dob = watch("dob");
  const duplicates =
    phone.length >= 6 ? others.filter((p) => digits(p.phone) === phone) : [];

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Patient updated", "success");
        navigate(`/patients/${id}`);
      } else {
        const newId = await create.mutateAsync(values);
        showToast("Patient added", "success");
        navigate(
          startConsultation.current
            ? `/patients/${newId}/consultations/new`
            : `/patients/${newId}`,
        );
      }
    } catch {
      showToast("Could not save patient. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;
  const label = (text: string) => (
    <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>
      {text}
    </Typography>
  );

  return (
    <Box
      component="form"
      noValidate
      onSubmit={onSubmit}
      sx={{
        ...CARD_SX,
        borderRadius: "24px",
        maxWidth: 880,
        mx: "auto",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 320px" },
        boxShadow: "0 24px 60px rgba(20,26,46,.08)",
      }}
    >
      <Box
        sx={{
          p: { xs: 2.5, sm: "28px 32px" },
          display: "flex",
          flexDirection: "column",
          gap: 2.25,
        }}
      >
        <Box>
          <Typography
            variant="h1"
            sx={{ fontSize: 22, letterSpacing: "-0.01em" }}
          >
            {isEdit ? "Edit patient" : "Add patient"}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {isEdit
              ? existing
                ? `#${existing.serialNo} · registered patient`
                : "Loading…"
              : allPatients
                ? `Will be registered as #${nextSerial}`
                : "A patient number is assigned on save"}
          </Typography>
        </Box>

        <Box>
          {label("Phone")}
          <TextField
            fullWidth
            type="tel"
            placeholder="Mobile number"
            inputProps={{ "aria-label": "Phone", inputMode: "tel" }}
            autoFocus={!isEdit}
            {...register("phone")}
          />
        </Box>

        <Box>
          {label("Full name")}
          <TextField
            fullWidth
            required
            placeholder="Patient's name"
            inputProps={{ "aria-label": "Full name" }}
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "190px 1fr" },
            gap: 1.75,
          }}
        >
          <Box>
            {label(
              dob ? `Date of birth · ${calcAge(dob)} yrs` : "Date of birth",
            )}
            <Controller
              name="dob"
              control={control}
              render={({ field }) => (
                <TextField
                  type="date"
                  fullWidth
                  required
                  inputProps={{ "aria-label": "Date of birth" }}
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
          </Box>
          <Box>
            {label("Sex")}
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  aria-label="Sex"
                  value={field.value}
                  onChange={(_, v) => v && field.onChange(v)}
                  sx={{ height: 56 }}
                >
                  {GENDERS.map((g) => (
                    <ToggleButton key={g} value={g}>
                      {g}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            />
          </Box>
        </Box>

        <Box>
          {label("Place")}
          <TextField
            fullWidth
            placeholder="Start typing…"
            inputProps={{ "aria-label": "Place" }}
            {...register("place")}
          />
          {places.length > 0 && (
            <Box
              sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25 }}
            >
              {places.map((p) => (
                <ButtonBase
                  key={p}
                  onClick={() => setValue("place", p, { shouldDirty: true })}
                  sx={{
                    ...PILL_SX,
                    px: 1.5,
                    py: 0.625,
                    bgcolor: TOKENS.blue50,
                    color: TOKENS.blue700,
                    "&:hover": { bgcolor: TOKENS.blue100 },
                  }}
                >
                  {p}
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1.25, mt: 0.75, flexWrap: "wrap" }}>
          {isEdit ? (
            <>
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                sx={{ flex: 1, height: 48 }}
              >
                {busy ? "Saving..." : "Save changes"}
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(-1)}
                disabled={busy}
                sx={{ height: 48 }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                onClick={() => (startConsultation.current = true)}
                sx={{ flex: 1, height: 48 }}
              >
                {busy ? "Saving..." : "Save & start consultation"}
              </Button>
              <Button
                type="submit"
                variant="outlined"
                disabled={busy}
                onClick={() => (startConsultation.current = false)}
                sx={{ height: 48 }}
              >
                Save only
              </Button>
            </>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          bgcolor: TOKENS.ground,
          p: { xs: 2.5, md: "28px 24px" },
          borderLeft: { md: LINE },
          borderTop: { xs: LINE, md: "none" },
          display: "flex",
          flexDirection: "column",
          gap: 1.75,
        }}
      >
        {duplicates.length > 0 ? (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              Possible duplicate
            </Typography>
            {duplicates.map((p) => (
              <Box
                key={p.id}
                sx={{
                  bgcolor: TOKENS.white,
                  borderRadius: "18px",
                  p: 2.25,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  border: `1px solid ${TOKENS.warnBg}`,
                  boxShadow: "0 4px 14px rgba(138,83,0,.08)",
                }}
              >
                <Box
                  component="span"
                  sx={{
                    ...PILL_SX,
                    alignSelf: "flex-start",
                    fontWeight: 700,
                    bgcolor: TOKENS.warnBg,
                    color: TOKENS.warn,
                  }}
                >
                  Same phone number
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <AvatarTile name={p.name} size={44} solid />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
                      {p.name}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      #{p.serialNo} · {calcAge(p.dob)} {p.gender[0]}
                      {p.place ? ` · ${p.place}` : ""}
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  {p.lastVisitAt
                    ? `Last visit ${daysAgoLabel(p.lastVisitAt).toLowerCase()}`
                    : "No visits yet"}
                </Typography>
                <Button
                  component={Link}
                  to={`/patients/${p.id}`}
                  sx={{
                    height: 40,
                    bgcolor: TOKENS.blue50,
                    color: TOKENS.blue700,
                    fontSize: 13,
                    "&:hover": { bgcolor: TOKENS.blue100 },
                  }}
                >
                  Open existing record
                </Button>
              </Box>
            ))}
            <Typography
              sx={{ fontSize: 13, lineHeight: 1.5, color: "text.secondary" }}
            >
              Family members can share a phone number. Save anyway if this is a
              different person.
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Tips</Typography>
            <Typography
              sx={{ fontSize: 13, lineHeight: 1.5, color: "text.secondary" }}
            >
              Enter the phone number first — if it already belongs to a
              registered patient, they’ll show up here so you don’t create a
              duplicate.
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
