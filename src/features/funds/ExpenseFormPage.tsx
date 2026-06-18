import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { expenseFormSchema, EXPENSE_CATEGORIES, type ExpenseFormValues } from "./fundsSchema";
import { useExpense, useCreateExpense, useUpdateExpense, useDeleteExpense } from "./useFunds";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";

const DEFAULTS: Partial<ExpenseFormValues> = {
  category: "Other", amount: 0, note: "",
};

export default function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = useExpense(id);
  const create = useCreateExpense();
  const update = useUpdateExpense(id ?? "");
  const remove = useDeleteExpense();

  const { control, handleSubmit, reset, register, formState: { errors } } =
    useForm<ExpenseFormValues>({
      resolver: zodResolver(expenseFormSchema),
      defaultValues: { ...DEFAULTS, date: Date.now() } as ExpenseFormValues,
    });

  useEffect(() => {
    if (existing) {
      reset({
        date: existing.date, category: existing.category,
        amount: existing.amount, note: existing.note,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Expense updated", "success");
      } else {
        await create.mutateAsync(values);
        showToast("Expense added", "success");
      }
      navigate("/funds");
    } catch {
      showToast("Could not save expense. Please try again.", "error");
    }
  });

  const onDelete = async () => {
    if (!id || !window.confirm("Delete this expense?")) return;
    try {
      await remove.mutateAsync(id);
      showToast("Expense deleted", "success");
      navigate("/funds");
    } catch {
      showToast("Could not delete expense. Please try again.", "error");
    }
  };

  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Box component="form" onSubmit={onSubmit} noValidate sx={{ maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{isEdit ? "Edit expense" : "Add expense"}</Typography>
      <Stack spacing={2}>
        <Controller name="date" control={control} render={({ field }) => (
          <TextField label="Date" type="date" fullWidth required
            InputLabelProps={{ shrink: true }}
            value={field.value ? msToDateInput(field.value) : ""}
            onChange={(e) => field.onChange(e.target.value ? dateInputToMs(e.target.value) : undefined)}
            error={!!errors.date} helperText={errors.date?.message} />
        )} />

        <Controller name="category" control={control} render={({ field }) => (
          <TextField label="Category" select fullWidth required {...field}
            error={!!errors.category} helperText={errors.category?.message}>
            {EXPENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        )} />

        <Controller name="amount" control={control} render={({ field }) => (
          <TextField label="Amount (₹)" type="number" fullWidth required
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.amount} helperText={errors.amount?.message} />
        )} />

        <TextField label="Note" fullWidth multiline minRows={2} {...register("note")} />

        <Stack direction="row" spacing={2} justifyContent="space-between">
          {isEdit ? (
            <Button color="error" onClick={onDelete} disabled={busy}>Delete</Button>
          ) : <span />}
          <Stack direction="row" spacing={2}>
            <Button onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
