import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { computePayroll } from "./payroll";
import { useMarkPaid } from "./useStaff";
import {
  PAYMENT_MODES,
  type Leave,
  type PaymentMode,
  type SalaryPayment,
  type Staff,
} from "./staffSchema";
import {
  dateInputToZonedMs,
  formatMonth,
  zonedMsToDateInput,
} from "../../lib/zonedDates";
import { useToast } from "../../components/useToast";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

interface Props {
  staff: Staff;
  /** The month's leaves for this staff member. */
  leaves: Leave[];
  month: string;
  /** The existing payment when paying again; its values prefill the form. */
  payment?: SalaryPayment;
  tz: string;
  onClose: () => void;
}

export default function MarkPaidDialog({
  staff,
  leaves,
  month,
  payment,
  tz,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const markPaid = useMarkPaid();
  const [adjustment, setAdjustment] = useState(
    String(payment?.adjustment ?? 0),
  );
  const [note, setNote] = useState(payment?.adjustmentNote ?? "");
  const [paidOn, setPaidOn] = useState(() =>
    zonedMsToDateInput(payment?.paidOn ?? Date.now(), tz),
  );
  const [mode, setMode] = useState<PaymentMode>(payment?.paymentMode ?? "Cash");

  const adj = Number(adjustment);
  const adjValid = adjustment.trim() !== "" && Number.isInteger(adj);
  const line = computePayroll(staff, leaves, month, tz, adjValid ? adj : 0);

  const submit = async () => {
    try {
      await markPaid.mutateAsync({
        staffId: staff.id,
        staffName: staff.name,
        month,
        base: line.base,
        paidDays: line.paidDays,
        unpaidDays: line.unpaidDays,
        deduction: line.deduction,
        adjustment: line.adjustment,
        adjustmentNote: note.trim(),
        net: line.net,
        paidOn: dateInputToZonedMs(paidOn, tz),
        paymentMode: mode,
      });
      showToast("Salary marked paid", "success");
      onClose();
    } catch {
      showToast("Could not mark salary paid. Please try again.", "error");
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {staff.name} · {formatMonth(month)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            Base {inr(line.base)} · Deduction −{inr(line.deduction)}
          </Typography>
          <TextField
            label="Adjustment (₹)"
            type="number"
            inputProps={{ step: 1 }}
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            error={!adjValid}
            helperText={adjValid ? "May be negative" : "Whole rupees only"}
            fullWidth
          />
          <TextField
            label="Adjustment note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            fullWidth
          />
          <TextField
            label="Paid on"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}
            fullWidth
          >
            {PAYMENT_MODES.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <Typography sx={{ fontWeight: 700 }}>Net {inr(line.net)}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={markPaid.isPending || !adjValid || !paidOn}
        >
          {payment ? "Update payment" : "Mark paid"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
