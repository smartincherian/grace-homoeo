import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  inventoryFormSchema,
  baseUnitLabel,
  unitCostOf,
  type InventoryFormValues,
  type MedicineForm,
} from "./inventorySchema";
import {
  useInventoryItem,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from "./useInventory";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";

const DEFAULTS: InventoryFormValues = {
  name: "",
  quantity: 0,
  unit: "",
  reorderLevel: 0,
  notes: "",
  form: "flat",
  purchaseCost: 0,
  lotSize: 1,
};

const FORM_OPTIONS: { value: MedicineForm; label: string }[] = [
  { value: "pieces", label: "Pills / pieces" },
  { value: "liquid", label: "Liquid" },
  { value: "packaging", label: "Empty bottles / packaging" },
  { value: "flat", label: "Whole unit / flat" },
];

const LOT_LABEL: Record<MedicineForm, string> = {
  pieces: "Pills in the lot",
  liquid: "Total volume (ml)",
  packaging: "Bottles in the pack",
  flat: "",
};

export default function InventoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useSetPageTitle(isEdit ? "Edit item" : "Add item");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = useInventoryItem(id);
  const create = useCreateItem();
  const update = useUpdateItem(id ?? "");
  const remove = useDeleteItem();

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    formState: { errors },
  } = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: DEFAULTS,
  });

  const form = useWatch({ control, name: "form" });
  const purchaseCost = useWatch({ control, name: "purchaseCost" });
  const lotSize = useWatch({ control, name: "lotSize" });
  const isFlat = form === "flat";
  const ratePreview =
    purchaseCost > 0 && lotSize > 0
      ? `≈ ₹${unitCostOf({ purchaseCost, lotSize }).toFixed(2)} / ${baseUnitLabel(
          form,
        )}`
      : null;

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        quantity: existing.quantity,
        unit: existing.unit,
        reorderLevel: existing.reorderLevel,
        notes: existing.notes,
        form: existing.form,
        purchaseCost: existing.purchaseCost,
        lotSize: existing.lotSize,
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
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{ maxWidth: 480, mx: "auto" }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3 }}>
            {isEdit ? "Edit item" : "Add item"}
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Name"
              fullWidth
              required
              {...register("name")}
              error={!!errors.name}
              helperText={errors.name?.message}
            />

            <Controller
              name="quantity"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Quantity"
                  type="number"
                  fullWidth
                  required
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                />
              )}
            />

            <TextField
              label="Unit"
              fullWidth
              placeholder="e.g. vials, drops, g"
              {...register("unit")}
            />

            <Controller
              name="reorderLevel"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Reorder level"
                  type="number"
                  fullWidth
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  error={!!errors.reorderLevel}
                  helperText={errors.reorderLevel?.message}
                />
              )}
            />

            <TextField
              label="Notes"
              fullWidth
              multiline
              minRows={2}
              {...register("notes")}
            />

            <Typography variant="subtitle2" color="text.secondary">
              Cost (for the Rate Calculator)
            </Typography>

            <Controller
              name="form"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Form"
                  fullWidth
                  value={field.value}
                  onChange={(e) => {
                    const next = e.target.value as MedicineForm;
                    field.onChange(next);
                    if (next === "flat") setValue("lotSize", 1);
                  }}
                >
                  {FORM_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Stack direction="row" spacing={2}>
              <Controller
                name="purchaseCost"
                control={control}
                render={({ field }) => (
                  <TextField
                    label={isFlat ? "Cost per unit (₹)" : "Total purchase cost (₹)"}
                    type="number"
                    fullWidth
                    value={Number.isFinite(field.value) ? field.value : ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    error={!!errors.purchaseCost}
                    helperText={errors.purchaseCost?.message}
                  />
                )}
              />

              {!isFlat && (
                <Controller
                  name="lotSize"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={LOT_LABEL[form] || "Lot size"}
                      type="number"
                      fullWidth
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                      error={!!errors.lotSize}
                      helperText={errors.lotSize?.message}
                    />
                  )}
                />
              )}
            </Stack>

            {ratePreview && (
              <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                {ratePreview}
              </Typography>
            )}

            <Stack direction="row" spacing={2} justifyContent="space-between">
              {isEdit ? (
                <Button color="error" onClick={onDelete} disabled={busy}>
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Stack direction="row" spacing={2}>
                <Button onClick={() => navigate(-1)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={busy}>
                  {busy ? "Saving..." : "Save"}
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
