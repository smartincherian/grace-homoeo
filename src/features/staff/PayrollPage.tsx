import { useMemo, useState } from "react";
import { Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import {
  useDeletePayment,
  useMonthLeaves,
  useMonthPayments,
  useStaffList,
} from "./useStaff";
import { computePayroll } from "./payroll";
import MarkPaidDialog from "./MarkPaidDialog";
import type { Staff } from "./staffSchema";
import { useClinicTimeZone } from "../../lib/clinicQueries";
import { formatMonth, formatZonedDate, monthKeyOf } from "../../lib/zonedDates";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function PayrollPage() {
  const { clinicSlug } = useParams<{ clinicSlug: string }>();
  useSetPageTitle("Payroll");
  const { showToast } = useToast();
  const tz = useClinicTimeZone(clinicSlug);
  const [month, setMonth] = useState(() => monthKeyOf(Date.now(), tz));
  const staff = useStaffList();
  const leaves = useMonthLeaves(month, tz);
  const payments = useMonthPayments(month);
  const del = useDeletePayment();
  const [paying, setPaying] = useState<Staff | null>(null);
  const [undoing, setUndoing] = useState<Staff | null>(null);

  const statuses = [staff.status, leaves.status, payments.status];
  const status = statuses.includes("error")
    ? "error"
    : statuses.includes("pending")
      ? "pending"
      : "success";

  const rows = useMemo(() => {
    const paymentFor = new Map(
      (payments.data ?? []).map((p) => [p.staffId, p]),
    );
    return (staff.data ?? [])
      .map((s) => ({
        staff: s,
        line: computePayroll(
          s,
          (leaves.data ?? []).filter((l) => l.staffId === s.id),
          month,
          tz,
        ),
        payment: paymentFor.get(s.id),
      }))
      .filter((r) => r.line.employedDays > 0 || r.payment)
      .sort((a, b) => a.staff.name.localeCompare(b.staff.name));
  }, [staff.data, leaves.data, payments.data, month, tz]);

  const total = rows.reduce((sum, r) => sum + r.line.net, 0);

  const confirmUndo = async () => {
    const s = undoing;
    setUndoing(null);
    if (!s) return;
    try {
      await del.mutateAsync({ staffId: s.id, month });
      showToast("Payment undone", "success");
    } catch {
      showToast("Could not undo payment. Please try again.", "error");
    }
  };

  return (
    <Box>
      <PageHeader
        title="Payroll"
        subtitle={formatMonth(month)}
        actions={
          <TextField
            type="month"
            size="small"
            label="Month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        }
      />
      <QueryStates
        status={status}
        isEmpty={rows.length === 0}
        emptyMessage="No staff employed this month"
      >
        {rows.map(({ staff: s, line, payment }) => (
          <ListCard
            key={s.id}
            primary={s.name}
            secondary={
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                <Typography component="span" sx={{ fontSize: 13 }}>
                  Base {inr(line.base)} · Unpaid {line.unpaidDays} days (−
                  {inr(line.deduction)}) · Net {inr(line.net)}
                </Typography>
                {payment && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                  >
                    <Chip
                      size="small"
                      color="success"
                      label={`Paid ${inr(payment.net)} on ${formatZonedDate(payment.paidOn, tz)} · ${payment.paymentMode}`}
                    />
                    {payment.needsReview && (
                      <Chip
                        size="small"
                        color="warning"
                        label="Leave changed — review"
                      />
                    )}
                    {payment.needsReview && line.net !== payment.net && (
                      <Chip size="small" label={`Now ${inr(line.net)}`} />
                    )}
                  </Stack>
                )}
              </Stack>
            }
            trailing={
              payment ? (
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setPaying(s)}>
                    Pay again
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setUndoing(s)}
                  >
                    Undo payment
                  </Button>
                </Stack>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setPaying(s)}
                >
                  Mark paid
                </Button>
              )
            }
          />
        ))}
        <Typography sx={{ fontWeight: 700, mt: 2, textAlign: "right" }}>
          Total net {inr(total)}
        </Typography>
      </QueryStates>

      {paying && (
        <MarkPaidDialog
          staff={paying}
          leaves={(leaves.data ?? []).filter((l) => l.staffId === paying.id)}
          month={month}
          tz={tz}
          onClose={() => setPaying(null)}
        />
      )}
      <ConfirmDialog
        open={!!undoing}
        title="Undo payment?"
        message="The payment record will be removed and the month shown as unpaid."
        confirmLabel="Undo payment"
        onConfirm={() => void confirmUndo()}
        onClose={() => setUndoing(null)}
      />
    </Box>
  );
}
