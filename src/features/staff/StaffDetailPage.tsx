import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useDeleteLeave,
  useStaffLeaves,
  useStaffMember,
  useStaffPayments,
} from "./useStaff";
import { leaveTotalsForYear } from "./payroll";
import { LEAVE_TYPES, type Leave } from "./staffSchema";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import {
  formatMonth,
  formatZonedDate,
  monthKeyOf,
  zonedMsToDateInput,
} from "../../lib/zonedDates";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { useClinicPath } from "../auth/useClinicPath";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function StaffDetailPage() {
  const cp = useClinicPath();
  const { clinicSlug, id } = useParams<{ clinicSlug: string; id: string }>();
  useSetPageTitle("Staff");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const tz = useClinicTimeZone(clinicSlug);
  const staff = useStaffMember(id);
  const leaves = useStaffLeaves(id);
  const payments = useStaffPayments(id);
  const del = useDeleteLeave(tz);
  const thisYear = Number(monthKeyOf(Date.now(), tz).slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [toDelete, setToDelete] = useState<Leave | null>(null);

  const s = staff.data;
  const years = useMemo(() => {
    const first = s
      ? Number(zonedMsToDateInput(s.joinedOn, tz).slice(0, 4))
      : thisYear;
    const out: number[] = [];
    for (let y = thisYear; y >= Math.min(first, thisYear); y--) out.push(y);
    if (!out.includes(year)) out.push(year);
    return out.sort((a, b) => b - a);
  }, [s, tz, thisYear, year]);

  const totals = leaveTotalsForYear(leaves.data ?? [], year, tz);
  const totalsText = LEAVE_TYPES.map((t) => `${t} ${totals[t]}`).join(" · ");

  const range = (l: Leave) =>
    l.from === l.to
      ? `${formatZonedDate(l.from, tz)}${l.halfDay ? " (half day)" : ""}`
      : `${formatZonedDate(l.from, tz)} – ${formatZonedDate(l.to, tz)}`;

  const confirmDelete = async () => {
    const leave = toDelete;
    setToDelete(null);
    if (!leave) return;
    try {
      await del.mutateAsync(leave);
      showToast("Leave deleted", "success");
    } catch {
      showToast("Could not delete leave. Please try again.", "error");
    }
  };

  const subtitle = s
    ? [
        s.designation,
        `${inr(s.monthlySalary)}/month`,
        `Joined ${formatZonedDate(s.joinedOn, tz)}`,
        s.leftOn !== null ? `Left ${formatZonedDate(s.leftOn, tz)}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <Box>
      <PageHeader
        title={s?.name ?? "Staff"}
        subtitle={subtitle}
        actions={
          <Button
            component={Link}
            to={cp(`/staff/${id}/edit`)}
            variant="outlined"
          >
            Edit
          </Button>
        }
      />

      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ mb: 2, flexWrap: "wrap" }}
      >
        <TextField
          select
          size="small"
          label="Year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: 100 }}
        >
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
        <Chip label={`Leave in ${year}: ${totalsText}`} />
      </Stack>

      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Leaves
        </Typography>
        <Button
          component={Link}
          to={cp(`/staff/${id}/leaves/new`)}
          variant="contained"
        >
          Add leave
        </Button>
      </Stack>
      <QueryStates
        status={leaves.status}
        isEmpty={(leaves.data ?? []).length === 0}
        emptyMessage="No leave recorded"
      >
        {(leaves.data ?? []).map((l) => (
          <ListCard
            key={l.id}
            primary={range(l)}
            secondary={[l.type, l.note].filter(Boolean).join(" · ")}
            menu={
              <RowMenu
                label={`leave ${range(l)}`}
                onEdit={() => navigate(cp(`/staff/${id}/leaves/${l.id}/edit`))}
                onDelete={() => setToDelete(l)}
              />
            }
          />
        ))}
      </QueryStates>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Payments
      </Typography>
      <QueryStates
        status={payments.status}
        isEmpty={(payments.data ?? []).length === 0}
        emptyMessage="No payments yet"
      >
        {(payments.data ?? []).map((p) => (
          <ListCard
            key={p.id}
            primary={`${formatMonth(p.month)} · ${inr(p.net)}`}
            secondary={`${formatZonedDate(p.paidOn, tz)} · ${p.paymentMode}`}
            trailing={
              p.needsReview ? (
                <Chip size="small" color="warning" label="Needs review" />
              ) : undefined
            }
          />
        ))}
      </QueryStates>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete leave?"
        message="This leave will be removed. A salary month already paid will be marked for review."
        onConfirm={() => void confirmDelete()}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
