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
  tz: string;
  onClose: () => void;
}

export default function MarkPaidDialog({
  staff,
  leaves,
  month,
  tz,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const markPaid = useMarkPaid();
  const [adjustment, setAdjustment] = useState("0");
  const [note, setNote] = useState("");
  const [paidOn, setPaidOn] = useState(() =>
    zonedMsToDateInput(Date.now(), tz),
  );
  const [mode, setMode] = useState<PaymentMode>("Cash");

  const adj = Number(adjustment);
  const adjValid = adjustment.trim() !== "" && Number.isFinite(adj);
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
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            error={!adjValid}
            helperText={adjValid ? "May be negative" : "Enter a number"}
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
          Mark paid
        </Button>
      </DialogActions>
    </Dialog>
  );
}
