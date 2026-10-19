import { useMemo, useState } from "react";
import {
  Box,
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
import { PageHeader } from "../../components/PageLayout";
import { CARD_SX, GRADIENT, PILL_SX, TOKENS } from "../../theme/theme";
import { useToast } from "../../components/useToast";
import { useClinicPath } from "../auth/useClinicPath";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function StatCard({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: "20px",
        px: { xs: 1.75, sm: 2.5 },
        py: { xs: 1.5, sm: 2 },
        ...(highlight
          ? { background: GRADIENT, color: "#fff" }
          : { ...CARD_SX }),
      }}
    >
      <Typography sx={{ fontSize: 13, opacity: highlight ? 0.85 : 1, color: highlight ? "inherit" : "text.secondary" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: 18, sm: 26 }, fontWeight: 800, color }} noWrap>
        {value}
      </Typography>
    </Box>
  );
}

export default function FundsPage() {
  const cp = useClinicPath();
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
      <PageHeader title="Funds" subtitle="Income from consultations, minus expenses" />
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 2.5, maxWidth: { sm: 520 }, "& .MuiOutlinedInput-root": { bgcolor: TOKENS.white } }}
      >
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
          color={TOKENS.ok}
        />
        <StatCard
          label="Expenses"
          value={stat(summary.totalExpenses)}
          color={TOKENS.danger}
        />
        <StatCard
          label="Balance"
          value={stat(summary.balance)}
          color={summary.balance < 0 ? TOKENS.dangerBg : undefined}
          highlight
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
            <Box
              key={m.mode}
              component="span"
              sx={{ ...PILL_SX, bgcolor: TOKENS.blue50, color: TOKENS.blue700 }}
            >
              {m.mode}: {inr(m.amount)}
            </Box>
          ))}
        </Stack>
      )}

      <Typography sx={{ fontSize: 18, fontWeight: 800, mb: 1.5 }}>
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
            onClick={() => navigate(cp(`/funds/expenses/${e.id}/edit`))}
            primary={e.category}
            secondary={`${formatDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
            trailing={
              <Typography sx={{ color: TOKENS.danger, fontWeight: 700 }}>
                {inr(e.amount)}
              </Typography>
            }
            menu={
              <RowMenu
                label={e.category}
                onEdit={() => navigate(cp(`/funds/expenses/${e.id}/edit`))}
                onDelete={() => setToDelete(e)}
              />
            }
          />
        ))}
      </QueryStates>

      <AddButton label="Add expense" to={cp("/funds/expenses/new")} />
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
