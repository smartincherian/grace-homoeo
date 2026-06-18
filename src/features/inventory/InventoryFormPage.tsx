import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryFormSchema, type InventoryFormValues } from "./inventorySchema";
import { useInventoryItem, useCreateItem, useUpdateItem, useDeleteItem } from "./useInventory";
import { useToast } from "../../components/useToast";

const DEFAULTS: InventoryFormValues = {
  name: "", quantity: 0, unit: "", reorderLevel: 0, notes: "",
};

export default function InventoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = useInventoryItem(id);
  const create = useCreateItem();
  const update = useUpdateItem(id ?? "");
  const remove = useDeleteItem();

  const { control, handleSubmit, reset, register, formState: { errors } } =
    useForm<InventoryFormValues>({
      resolver: zodResolver(inventoryFormSchema),
      defaultValues: DEFAULTS,
    });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name, quantity: existing.quantity, unit: existing.unit,
        reorderLevel: existing.reorderLevel, notes: existing.notes,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Item updated", "success");
      } else {
        await create.mutateAsync(values);
        showToast("Item added", "success");
      }
      navigate("/inventory");
    } catch {
      showToast("Could not save item. Please try again.", "error");
    }
  });

  const onDelete = async () => {
    if (!id || !window.confirm("Delete this item?")) return;
    try {
      await remove.mutateAsync(id);
      showToast("Item deleted", "success");
      navigate("/inventory");
    } catch {
      showToast("Could not delete item. Please try again.", "error");
    }
  };

  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{isEdit ? "Edit item" : "Add item"}</Typography>
      <Stack spacing={2}>
        <TextField label="Name" fullWidth required
          {...register("name")} error={!!errors.name} helperText={errors.name?.message} />

        <Controller name="quantity" control={control} render={({ field }) => (
          <TextField label="Quantity" type="number" fullWidth required
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.quantity} helperText={errors.quantity?.message} />
        )} />

        <TextField label="Unit" fullWidth placeholder="e.g. vials, drops, g"
          {...register("unit")} />

        <Controller name="reorderLevel" control={control} render={({ field }) => (
          <TextField label="Reorder level" type="number" fullWidth
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.reorderLevel} helperText={errors.reorderLevel?.message} />
        )} />

        <TextField label="Notes" fullWidth multiline minRows={2} {...register("notes")} />

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
