import { useEffect, useState } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import {
  useDayAppointments,
  type AppointmentStatus,
} from "../lib/appointments";
import { useClinicTimeZone } from "../lib/clinicQueries";
import { dayStartInZone, formatZonedTime } from "../lib/zonedDates";
import { useClinicPath } from "../features/auth/useClinicPath";
import { LINE, TOKENS } from "../theme/theme";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  booked: "Booked",
  arrived: "Arrived",
  done: "Done",
};

/** Compact strip of today's appointments; renders nothing when there are none. */
export default function TodayAppointments({ clinicId }: { clinicId: string }) {
  const cp = useClinicPath();
  const tz = useClinicTimeZone(clinicId);
  // Minute tick so "today" rolls over at midnight without a remount.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const dayStart = dayStartInZone(now, tz);
  const { status, data } = useDayAppointments(clinicId, dayStart);
  if (status !== "success" || !data || data.length === 0) return null;

  return (
    <Box component="section" aria-label="Today's appointments" sx={{ mb: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 15 }}>
          Today's appointments
        </Typography>
        <Typography
          component={Link}
          to={cp("/bookings")}
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: TOKENS.blue,
            textDecoration: "none",
          }}
        >
          View all
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {data.map((a) => (
          <ButtonBase
            key={a.id}
            component={Link}
            to={cp("/bookings")}
            sx={{
              px: 1.75,
              py: 0.75,
              borderRadius: "99px",
              fontSize: 13,
              fontWeight: 600,
              bgcolor: TOKENS.white,
              color: TOKENS.ink,
              border: LINE,
            }}
          >
            {`${formatZonedTime(a.start, tz)} · ${a.patientName} · ${STATUS_LABEL[a.status]}`}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}
