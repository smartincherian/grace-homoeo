import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { dayRows, type DayRow } from "./dayRows";
import BookDialog from "./BookDialog";
import {
  useCloseAppointment,
  useDayHistory,
  useMarkArrived,
} from "./useBookings";
import {
  hasHours,
  holidayOn,
  slotsForDay,
  useSchedule,
} from "../../lib/schedule";
import {
  useDayAppointments,
  type Appointment,
  type AppointmentStatus,
} from "../../lib/appointments";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import {
  addDaysInZone,
  dateInputToZonedMs,
  dayStartInZone,
  formatZonedDate,
  formatZonedTime,
  weekdayKeyOf,
  zonedMsToDateInput,
} from "../../lib/zonedDates";
import { canManageClinic, normalizeEmail } from "../../lib/access";
import { useMembership } from "../auth/AuthGuard";
import { useAuth } from "../auth/useAuth";
import { useClinicPath } from "../auth/useClinicPath";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import RowMenu, { type RowAction } from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { TOKENS } from "../../theme/theme";

const STATUS_CHIP: Record<
  AppointmentStatus,
  { label: string; color: "primary" | "warning" | "success" }
> = {
  booked: { label: "Booked", color: "primary" },
  arrived: { label: "Arrived", color: "warning" },
  done: { label: "Done", color: "success" },
};

type Closing = { appointment: Appointment; status: "cancelled" | "no-show" };

const weekdayName = (ms: number, tz: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(
    ms,
  );

/** Re-renders every minute so slots that end drop off an open day view. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function BookingsPage() {
  const { clinicSlug = "" } = useParams<{ clinicSlug: string }>();
  useSetPageTitle("Bookings");
  const cp = useClinicPath();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const owner = canManageClinic(useMembership(), clinicSlug);
  const tz = useClinicTimeZone(clinicSlug);
  const now = useNow();
  const today = dayStartInZone(now, tz);

  const [params, setParams] = useSearchParams();
  const dayParam = params.get("day") ?? "";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dayParam)
    ? dateInputToZonedMs(dayParam, tz)
    : NaN;
  const dayStart = Number.isFinite(parsed) ? parsed : today;
  const dayInput = zonedMsToDateInput(dayStart, tz);
  const goTo = (ms: number) => setParams({ day: zonedMsToDateInput(ms, tz) });

  const schedule = useSchedule(clinicSlug);
  const appts = useDayAppointments(clinicSlug, dayStart);
  const history = useDayHistory(clinicSlug, dayStart);
  const close = useCloseAppointment();
  const arrived = useMarkArrived();

  const [booking, setBooking] = useState<DayRow | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);

  const s = schedule.data;
  const holiday = s ? holidayOn(dayStart, s) : undefined;
  const rows = useMemo(
    () =>
      dayRows(
        s ? slotsForDay(dayStart, s, tz) : [],
        appts.data ?? [],
        history.data ?? [],
        now,
      ),
    [s, dayStart, tz, appts.data, history.data, now],
  );

  const statuses = [schedule.status, appts.status, history.status];
  const status = statuses.includes("error")
    ? "error"
    : statuses.includes("pending")
      ? "pending"
      : "success";

  const by = normalizeEmail(user?.email ?? "");
  const registerUrl = (a: Appointment) =>
    cp(
      `/patients/new?appointment=${a.id}&name=${encodeURIComponent(a.patientName)}&phone=${encodeURIComponent(a.phone)}&day=${zonedMsToDateInput(a.date, tz)}`,
    );

  const markArrived = async (a: Appointment) => {
    try {
      await arrived.mutateAsync(a.id);
    } catch {
      showToast("Could not update the appointment. Please try again.", "error");
    }
  };

  const confirmClose = async () => {
    const c = closing;
    setClosing(null);
    if (!c) return;
    try {
      await close.mutateAsync({ ...c, by });
      showToast(
        c.status === "cancelled" ? "Appointment cancelled" : "Marked no-show",
        "success",
      );
    } catch {
      showToast("Could not update the appointment. Please try again.", "error");
    }
  };

  const actionsFor = (a: Appointment): RowAction[] => {
    if (a.status === "done") {
      return a.patientId && a.consultationId
        ? [
            {
              label: "View consultation",
              onClick: () =>
                navigate(
                  cp(
                    `/patients/${a.patientId}/consultations/${a.consultationId}`,
                  ),
                ),
            },
          ]
        : [];
    }
    const list: RowAction[] = [];
    if (a.status === "booked") {
      list.push({ label: "Arrived", onClick: () => void markArrived(a) });
    }
    list.push({
      label: "Start consultation",
      onClick: () =>
        navigate(
          a.patientId
            ? cp(
                `/patients/${a.patientId}/consultations/new?appointment=${a.id}`,
              )
            : `${registerUrl(a)}&then=consultation`,
        ),
    });
    if (!a.patientId) {
      list.push({
        label: "Register patient",
        onClick: () => navigate(registerUrl(a)),
      });
    }
    list.push(
      {
        label: "Cancel",
        onClick: () => setClosing({ appointment: a, status: "cancelled" }),
      },
      {
        label: "No-show",
        onClick: () => setClosing({ appointment: a, status: "no-show" }),
      },
    );
    return list;
  };

  const banners = s && (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {!hasHours(s) ? (
        <Alert
          severity="info"
          action={
            owner && (
              <Button
                component={Link}
                to={cp("/settings#clinic-hours")}
                color="inherit"
                size="small"
              >
                Set clinic hours
              </Button>
            )
          }
        >
          Clinic hours not set
        </Alert>
      ) : holiday ? (
        <>
          <Alert severity="info">
            {holiday.note
              ? `Holiday — ${holiday.note}. Clinic closed.`
              : "Holiday. Clinic closed."}
          </Alert>
          {(appts.data?.length ?? 0) > 0 && (
            <Alert severity="warning">
              {`${appts.data?.length} appointment(s) are still booked on this day. Cancel them or keep them.`}
            </Alert>
          )}
        </>
      ) : s.weekly[weekdayKeyOf(dayStart, tz)].length === 0 ? (
        <Alert severity="info">{`Closed on ${weekdayName(dayStart, tz)}s.`}</Alert>
      ) : null}
    </Stack>
  );

  const timeCell = (r: DayRow) => (
    <Box
      sx={{
        width: 72,
        flex: "none",
        fontWeight: 700,
        fontSize: 14,
        color: TOKENS.blue700,
      }}
    >
      {formatZonedTime(r.start, tz)}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Bookings"
        subtitle={`${weekdayName(dayStart, tz)}, ${formatZonedDate(dayStart, tz)}`}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              aria-label="Previous day"
              onClick={() => goTo(addDaysInZone(dayStart, -1, tz))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <TextField
              type="date"
              size="small"
              label="Day"
              value={dayInput}
              onChange={(e) =>
                e.target.value && goTo(dateInputToZonedMs(e.target.value, tz))
              }
              InputLabelProps={{ shrink: true }}
            />
            <IconButton
              aria-label="Next day"
              onClick={() => goTo(addDaysInZone(dayStart, 1, tz))}
            >
              <ChevronRightIcon />
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              disabled={dayStart === today}
              onClick={() => setParams({})}
            >
              Today
            </Button>
          </Stack>
        }
      />
      {banners}
      <QueryStates
        status={status}
        isEmpty={rows.length === 0}
        emptyMessage="No open slots on this day"
      >
        {rows.map((r) => {
          const a = r.appointment;
          return (
            <Box key={r.start}>
              {a ? (
                <ListCard
                  avatar={timeCell(r)}
                  primary={
                    a.serialNo !== null
                      ? `${a.patientName} #${a.serialNo}`
                      : a.patientName
                  }
                  secondary={
                    <Stack component="span" spacing={0.25}>
                      {a.phone && <span>{a.phone}</span>}
                      {a.note && <span>{a.note}</span>}
                    </Stack>
                  }
                  trailing={
                    <Chip
                      size="small"
                      color={STATUS_CHIP[a.status].color}
                      label={STATUS_CHIP[a.status].label}
                    />
                  }
                  menu={
                    actionsFor(a).length > 0 && (
                      <RowMenu label={a.patientName} actions={actionsFor(a)} />
                    )
                  }
                />
              ) : (
                <ListCard
                  avatar={timeCell(r)}
                  primary={
                    <Typography
                      component="span"
                      sx={{ color: "text.secondary", fontWeight: 500 }}
                    >
                      Free
                    </Typography>
                  }
                  trailing={
                    r.end > now && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setBooking(r)}
                      >
                        Book
                      </Button>
                    )
                  }
                />
              )}
              {r.history.map((h) => (
                <Typography
                  key={`${h.start}_${h.createdAt}`}
                  sx={{
                    fontSize: 13,
                    color: "text.disabled",
                    ml: "88px",
                    mt: -0.5,
                    mb: 1,
                  }}
                >
                  {`${h.status === "cancelled" ? "Cancelled" : "No-show"} · ${h.patientName}`}
                </Typography>
              ))}
            </Box>
          );
        })}
      </QueryStates>
      {booking && (
        <BookDialog
          slot={{ start: booking.start, end: booking.end }}
          tz={tz}
          onClose={() => setBooking(null)}
        />
      )}
      <ConfirmDialog
        open={!!closing}
        title={
          closing?.status === "no-show"
            ? "Mark no-show?"
            : "Cancel appointment?"
        }
        message={
          closing
            ? `${closing.appointment.patientName} at ${formatZonedTime(closing.appointment.start, tz)}. The slot becomes free again.`
            : ""
        }
        confirmLabel={
          closing?.status === "no-show" ? "Mark no-show" : "Cancel appointment"
        }
        onConfirm={() => void confirmClose()}
        onClose={() => setClosing(null)}
      />
    </Box>
  );
}
