import { useMemo, useState } from "react";
import {
  Box, Card, CardContent, Chip, Divider, Fab, List, ListItem, ListItemButton,
  ListItemText, Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { Link, useNavigate } from "react-router-dom";
import { useIncome, useExpenses } from "./useFunds";
import { summarizePeriod } from "./fundsSchema";
import { formatDate, msToDateInput, dateInputToMs } from "../../lib/dates";
import QueryStates from "../../components/QueryStates";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 0 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ color, fontWeight: 600 }} noWrap>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function FundsPage() {
  const navigate = useNavigate();
  const [startMs, setStartMs] = useState(() => dayjs().startOf("month").valueOf());
  const [endMs, setEndMs] = useState(() => dayjs().endOf("month").valueOf());

  const income = useIncome(startMs, endMs);
  const expenses = useExpenses(startMs, endMs);

  const summary = useMemo(
    () => summarizePeriod(income.data ?? [], expenses.data ?? []),
    [income.data, expenses.data],
  );
  const summaryLoading = income.isPending || expenses.isPending;
  const summaryError = income.isError || expenses.isError;
  const stat = (value: number) => (summaryError ? "—" : summaryLoading ? "…" : inr(value));

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Funds</Typography>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField label="From" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
          value={msToDateInput(startMs)}
          onChange={(e) => e.target.value && setStartMs(dateInputToMs(e.target.value))} />
        <TextField label="To" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
          value={msToDateInput(endMs)}
          onChange={(e) => e.target.value && setEndMs(dayjs(dateInputToMs(e.target.value)).endOf("day").valueOf())} />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <StatCard label="Income" value={stat(summary.totalIncome)} color="success.main" />
        <StatCard label="Expenses" value={stat(summary.totalExpenses)} color="error.main" />
        <StatCard label="Balance" value={stat(summary.balance)}
          color={summary.balance < 0 ? "error.main" : "text.primary"} />
      </Stack>

      {!summaryLoading && !summaryError && summary.incomeByMode.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {summary.incomeByMode.map((m) => (
            <Chip key={m.mode} size="small" variant="outlined"
              label={`${m.mode}: ${inr(m.amount)}`} />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 1 }} />
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Expenses</Typography>

      <QueryStates status={expenses.status} isEmpty={(expenses.data ?? []).length === 0}
        emptyMessage="No expenses in this period">
        <List>
          {(expenses.data ?? []).map((e) => (
            <ListItem key={e.id} divider disableGutters
              secondaryAction={<Typography sx={{ color: "error.main" }}>{inr(e.amount)}</Typography>}>
              <ListItemButton onClick={() => navigate(`/funds/expenses/${e.id}/edit`)}>
                <ListItemText
                  primary={e.category}
                  secondary={`${formatDate(e.date)}${e.note ? ` · ${e.note}` : ""}`} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </QueryStates>

      <Fab color="primary" aria-label="Add expense" component={Link} to="/funds/expenses/new"
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
