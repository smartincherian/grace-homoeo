import { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useIncome, useExpenses, useDeleteExpense } from "./useFunds";
import { summarizePeriod } from "./fundsSchema";
import type { Expense } from "./fundsSchema";
import { formatDate, msToDateInput, dateInputToMs } from "../../lib/dates";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { useToast } from "../../components/useToast";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function StatCard({
  label,
  value,
  color,
  edge,
}: {
  label: string;
  value: string;
  color?: string;
  edge: string;
}) {
  return (
    <Card sx={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${edge}` }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ color, fontWeight: 700 }} noWrap>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function FundsPage() {
  useSetPageTitle("Funds");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [startMs, setStartMs] = useState(() =>
    dayjs().startOf("month").valueOf(),
  );
  const [endMs, setEndMs] = useState(() => dayjs().endOf("month").valueOf());
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const income = useIncome(startMs, endMs);
  const expenses = useExpenses(startMs, endMs);
  const deleteExpense = useDeleteExpense();

  const summary = useMemo(
    () => summarizePeriod(income.data ?? [], expenses.data ?? []),
    [income.data, expenses.data],
  );
  const summaryLoading = income.isPending || expenses.isPending;
  const summaryError = income.isError || expenses.isError;
  const stat = (value: number) =>
    summaryError ? "—" : summaryLoading ? "…" : inr(value);

  const confirmDelete = () => {
    if (!toDelete) return;
    const exp = toDelete;
    setToDelete(null);
    deleteExpense.mutate(exp.id, {
      onSuccess: () => showToast("Expense deleted", "success"),
      onError: () =>
        showToast("Could not delete expense. Please try again.", "error"),
    });
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="From"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={msToDateInput(startMs)}
          onChange={(e) =>
            e.target.value && setStartMs(dateInputToMs(e.target.value))
          }
        />
        <TextField
          label="To"
          type="date"
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          value={msToDateInput(endMs)}
          onChange={(e) =>
            e.target.value &&
            setEndMs(
              dayjs(dateInputToMs(e.target.value)).endOf("day").valueOf(),
            )
          }
        />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <StatCard
          label="Income"
          value={stat(summary.totalIncome)}
          color="success.main"
          edge="#16A39B"
        />
        <StatCard
          label="Expenses"
          value={stat(summary.totalExpenses)}
          color="error.main"
          edge="#C0496B"
        />
        <StatCard
          label="Balance"
          value={stat(summary.balance)}
          color={summary.balance < 0 ? "error.main" : "text.primary"}
          edge="#2E73D6"
        />
      </Stack>

      {!summaryLoading && !summaryError && summary.incomeByMode.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 3 }}
        >
          {summary.incomeByMode.map((m) => (
            <Chip
              key={m.mode}
              size="small"
              variant="outlined"
              label={`${m.mode}: ${inr(m.amount)}`}
            />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Expenses
      </Typography>

      <QueryStates
        status={expenses.status}
        isEmpty={(expenses.data ?? []).length === 0}
        emptyMessage="No expenses in this period"
      >
        {(expenses.data ?? []).map((e) => (
          <ListCard
            key={e.id}
            onClick={() => navigate(`/funds/expenses/${e.id}/edit`)}
            primary={e.category}
            secondary={`${formatDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
            trailing={
              <Typography sx={{ color: "error.main", fontWeight: 600 }}>
                {inr(e.amount)}
              </Typography>
            }
            menu={
              <RowMenu
                label={e.category}
                onEdit={() => navigate(`/funds/expenses/${e.id}/edit`)}
                onDelete={() => setToDelete(e)}
              />
            }
          />
        ))}
      </QueryStates>

      <AddButton label="Add expense" to="/funds/expenses/new" />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete expense?"
        message={
          toDelete
            ? `Delete "${toDelete.category}" (${inr(toDelete.amount)})? This cannot be undone.`
            : ""
        }
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
