import { useMemo } from "react";
import { Box, Button } from "@mui/material";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStaffList } from "./useStaff";
import type { Staff } from "./staffSchema";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import { dayStartInZone, formatZonedDate } from "../../lib/zonedDates";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { useClinicPath } from "../auth/useClinicPath";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function StaffListPage() {
  const cp = useClinicPath();
  const { clinicSlug } = useParams();
  useSetPageTitle("Staff");
  const navigate = useNavigate();
  const tz = useClinicTimeZone(clinicSlug);
  const staff = useStaffList();

  // Employed until the leaving date: a future date still counts as active.
  const isFuture = (leftOn: number) => leftOn > dayStartInZone(Date.now(), tz);
  const gone = (s: Staff) => s.leftOn !== null && !isFuture(s.leftOn);
  // Active staff first, then those who left; each group by name.
  const sorted = useMemo(
    () =>
      [...(staff.data ?? [])].sort(
        (a, b) =>
          Number(gone(a)) - Number(gone(b)) || a.name.localeCompare(b.name),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staff.data, tz],
  );

  const secondary = (s: Staff) => {
    const parts = [`${s.designation} · ${inr(s.monthlySalary)}/month`];
    if (s.leftOn !== null) {
      parts.push(`${isFuture(s.leftOn) ? "Leaving" : "Left"} ${formatZonedDate(s.leftOn, tz)}`);
    }
    return parts.join(" · ");
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <PageHeader
        title="Staff"
        subtitle="Leave and salary — visible only to you"
        actions={
          <Button
            component={Link}
            to={cp("/staff/payroll")}
            variant="outlined"
          >
            Payroll
          </Button>
        }
      />
      <QueryStates
        status={staff.status}
        isEmpty={sorted.length === 0}
        emptyMessage="No staff yet"
      >
        {sorted.map((s) => (
          <ListCard
            key={s.id}
            onClick={() => navigate(cp(`/staff/${s.id}`))}
            primary={s.name}
            secondary={secondary(s)}
          />
        ))}
      </QueryStates>
      <AddButton label="Add staff" to={cp("/staff/new")} />
    </Box>
  );
}
