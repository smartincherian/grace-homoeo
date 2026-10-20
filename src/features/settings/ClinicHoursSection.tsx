import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useToast } from "../../components/useToast";
import { useAuth } from "../auth/useAuth";
import { normalizeEmail } from "../../lib/access";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import {
  OffGridError,
  SLOT_CHOICES,
  WEEKDAYS,
  scheduleSchema,
  useSaveSchedule,
  useSchedule,
  type Schedule,
  type Weekday,
} from "../../lib/schedule";
import type { Appointment } from "../../lib/appointments";
import {
  dateInputToZonedMs,
  dayStartInZone,
  formatZonedDate,
  formatZonedTime,
} from "../../lib/zonedDates";
import { CARD_SX, GRADIENT, TOKENS } from "../../theme/theme";

const DAY_NAMES: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const MAX_SESSIONS = 3;
const NOTE_MAX = 60;

function Form({ clinicId, initial }: { clinicId: string; initial: Schedule }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const tz = useClinicTimeZone(clinicId);
  const save = useSaveSchedule(clinicId);
  const [draft, setDraft] = useState<Schedule>(initial);
  const [dayErrors, setDayErrors] = useState<Partial<Record<string, string>>>(
    {},
  );
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayNote, setHolidayNote] = useState("");
  const [holidayError, setHolidayError] = useState("");
  const [offGrid, setOffGrid] = useState<Appointment[]>([]);

  const today = dayStartInZone(Date.now(), tz);
  const upcoming = draft.holidays
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date - b.date);

  const setDay = (
    d: Weekday,
    f: (s: Schedule["weekly"][Weekday]) => Schedule["weekly"][Weekday],
  ) =>
    setDraft((s) => ({ ...s, weekly: { ...s.weekly, [d]: f(s.weekly[d]) } }));

  const addHoliday = () => {
    if (!holidayDate) {
      setHolidayError("Choose a date.");
      return;
    }
    if (holidayNote.length > NOTE_MAX) {
      setHolidayError("Keep the note under 60 characters.");
      return;
    }
    const date = dateInputToZonedMs(holidayDate, tz);
    setHolidayError("");
    setDraft((s) => ({
      ...s,
      holidays: [
        ...s.holidays.filter((h) => h.date !== date),
        { date, note: holidayNote.trim() },
      ],
    }));
    setHolidayDate("");
    setHolidayNote("");
  };

  const onSave = async () => {
    setOffGrid([]);
    const parsed = scheduleSchema.safeParse(draft);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const [root, day, idx] = issue.path;
        if (root === "weekly" && typeof day === "string") {
          errs[day] ??=
            typeof idx === "number"
              ? "End must be after start."
              : issue.message === "sessions overlap"
                ? "Sessions must not overlap."
                : "Check these times.";
        } else {
          errs.general = "Check the slot length.";
        }
      }
      setDayErrors(errs);
      return;
    }
    setDayErrors({});
    try {
      await save.mutateAsync({
        schedule: draft,
        by: normalizeEmail(user?.email ?? ""),
        tz,
      });
      showToast("Clinic hours saved", "success");
    } catch (e) {
      if (e instanceof OffGridError) setOffGrid(e.appointments);
      else showToast("Could not save clinic hours. Please try again.", "error");
    }
  };

  return (
    <>
      <TextField
        select
        label="Slot length"
        size="small"
        value={draft.slotMinutes}
        onChange={(e) =>
          setDraft((s) => ({ ...s, slotMinutes: Number(e.target.value) }))
        }
        slotProps={{ select: { native: true } }}
        sx={{ minWidth: 160, mb: 2 }}
        error={!!dayErrors.general}
        helperText={dayErrors.general}
      >
        {SLOT_CHOICES.map((m) => (
          <option key={m} value={m}>
            {m} minutes
          </option>
        ))}
      </TextField>

      <Stack spacing={1.5}>
        {WEEKDAYS.map((d) => {
          const sessions = draft.weekly[d];
          const name = DAY_NAMES[d];
          return (
            <Box key={d} data-testid={`day-${d}`}>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
              >
                <Typography sx={{ width: 96, fontWeight: 600, fontSize: 14 }}>
                  {name}
                </Typography>
                {sessions.length === 0 && (
                  <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
                    Closed
                  </Typography>
                )}
                {sessions.length < MAX_SESSIONS && (
                  <Button
                    size="small"
                    aria-label={`Add session ${name}`}
                    onClick={() =>
                      setDay(d, (l) => [...l, { start: "09:00", end: "13:00" }])
                    }
                  >
                    Add session
                  </Button>
                )}
              </Stack>
              {sessions.map((s, i) => (
                <Stack
                  key={i}
                  direction="row"
                  gap={1}
                  alignItems="center"
                  sx={{ mt: 1, ml: { sm: 12 } }}
                >
                  <TextField
                    type="time"
                    label="Start"
                    size="small"
                    value={s.start}
                    slotProps={{
                      htmlInput: { "aria-label": `${name} start ${i + 1}` },
                      inputLabel: { shrink: true },
                    }}
                    onChange={(e) =>
                      setDay(d, (l) =>
                        l.map((x, j) =>
                          j === i ? { ...x, start: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <TextField
                    type="time"
                    label="End"
                    size="small"
                    value={s.end}
                    slotProps={{
                      htmlInput: { "aria-label": `${name} end ${i + 1}` },
                      inputLabel: { shrink: true },
                    }}
                    onChange={(e) =>
                      setDay(d, (l) =>
                        l.map((x, j) =>
                          j === i ? { ...x, end: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <IconButton
                    aria-label={`Remove ${name} session ${i + 1}`}
                    onClick={() =>
                      setDay(d, (l) => l.filter((_, j) => j !== i))
                    }
                  >
                    <Box component="span" aria-hidden>
                      ×
                    </Box>
                  </IconButton>
                </Stack>
              ))}
              {dayErrors[d] && (
                <Typography
                  role="alert"
                  sx={{ color: TOKENS.danger, fontSize: 13, mt: 0.5 }}
                >
                  {dayErrors[d]}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>

      <Typography sx={{ fontWeight: 700, fontSize: 15, mt: 3, mb: 1 }}>
        Holidays
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap={1}
        alignItems="flex-start"
      >
        <TextField
          type="date"
          label="Holiday date"
          size="small"
          value={holidayDate}
          onChange={(e) => setHolidayDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Holiday note"
          size="small"
          value={holidayNote}
          onChange={(e) => setHolidayNote(e.target.value)}
          error={holidayNote.length > NOTE_MAX || !!holidayError}
          helperText={holidayError || undefined}
        />
        <Button variant="outlined" onClick={addHoliday}>
          Add holiday
        </Button>
      </Stack>
      <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 1 }}>
        {upcoming.map((h) => (
          <Stack
            component="li"
            key={h.date}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 0.5 }}
          >
            <Typography sx={{ fontSize: 14 }}>
              {formatZonedDate(h.date, tz)}
              {h.note ? ` · ${h.note}` : ""}
            </Typography>
            <IconButton
              aria-label={`Remove holiday ${formatZonedDate(h.date, tz)}`}
              onClick={() =>
                setDraft((s) => ({
                  ...s,
                  holidays: s.holidays.filter((x) => x.date !== h.date),
                }))
              }
            >
              <Box component="span" aria-hidden>
                ×
              </Box>
            </IconButton>
          </Stack>
        ))}
      </Box>

      {offGrid.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          These future bookings don&apos;t fit the new hours or slot length.
          Cancel them in Bookings first, then save.
          <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
            {offGrid.map((a) => (
              <li key={a.start}>
                {formatZonedDate(a.start, tz)} · {formatZonedTime(a.start, tz)}{" "}
                — {a.patientName}
              </li>
            ))}
          </Box>
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button
          variant="contained"
          onClick={() => void onSave()}
          disabled={save.isPending}
          sx={{ background: GRADIENT }}
        >
          Save hours
        </Button>
      </Box>
    </>
  );
}

export default function ClinicHoursSection({ clinicId }: { clinicId: string }) {
  const q = useSchedule(clinicId);
  return (
    <Box
      component="section"
      id="clinic-hours"
      sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 2.5 }}
    >
      <Typography variant="h2" sx={{ fontSize: 17, fontWeight: 700, mb: 1.5 }}>
        Clinic hours
      </Typography>
      {q.data ? (
        <Form clinicId={clinicId} initial={q.data} />
      ) : q.isError ? (
        <Typography>Couldn&apos;t load clinic hours.</Typography>
      ) : (
        <CircularProgress size={24} aria-label="Loading clinic hours" />
      )}
    </Box>
  );
}
