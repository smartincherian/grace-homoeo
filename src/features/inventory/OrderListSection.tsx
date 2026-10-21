import { useState, type FormEvent } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  ORDER_CATEGORIES,
  categoriesFor,
  categoryInfo,
  orderFormSchema,
  orderItemLabel,
  suggestionsFor,
  type OrderCategory,
  type OrderItem,
} from "./orderSchema";
import {
  useCreateOrderItem,
  useDeleteOrderItem,
  useMarkOrdered,
  useOrderItems,
} from "./useOrders";
import QueryStates from "../../components/QueryStates";
import { CAPTION_SX, CARD_SX, LINE, PILL_SX, TOKENS } from "../../theme/theme";
import { useToast } from "../../components/useToast";
import { useClinicFeatures } from "../../lib/useClinicFeatures";

const FIELD_SX = { "& .MuiOutlinedInput-root": { bgcolor: TOKENS.white } };

/** Free-typing text field that also offers earlier entries in a dropdown. */
function SuggestField({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={value}
      onInputChange={(_e, v) => onChange(v)}
      sx={{ flex: 1, minWidth: 140 }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          sx={FIELD_SX}
          error={!!error}
          helperText={error}
        />
      )}
    />
  );
}

export default function OrderListSection() {
  const { status, data } = useOrderItems();
  const create = useCreateOrderItem();
  const markOrdered = useMarkOrdered();
  const remove = useDeleteOrderItem();
  const { showToast } = useToast();

  const choices = categoriesFor(useClinicFeatures().type);
  const [picked, setCategory] = useState<OrderCategory>(choices[0].key);
  // The clinic type can arrive after the first render; fall back to its first.
  const category = choices.some((c) => c.key === picked)
    ? picked
    : choices[0].key;
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [quantity, setQuantity] = useState("");
  const [nameError, setNameError] = useState<string>();

  const all = data ?? [];
  const pending = all.filter((i) => !i.ordered);
  const info = categoryInfo(category);

  const changeCategory = (c: OrderCategory) => {
    setCategory(c);
    setName("");
    setVariant("");
    setNameError(undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = orderFormSchema.safeParse({
      category,
      name: info.needsName ? name : "",
      variant: info.variant ? variant : "",
      quantity,
    });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    setNameError(undefined);
    create.mutate(parsed.data, {
      onSuccess: () => {
        setName("");
        setVariant("");
        setQuantity("");
      },
      onError: () => showToast("Could not add item. Please try again.", "error"),
    });
  };

  const ordered = (item: OrderItem) =>
    markOrdered.mutate(item.id, {
      onSuccess: () => showToast(`${orderItemLabel(item)} ordered`, "success"),
      onError: () => showToast("Could not update. Please try again.", "error"),
    });

  const del = (item: OrderItem) =>
    remove.mutate(item.id, {
      onError: () => showToast("Could not remove. Please try again.", "error"),
    });

  return (
    <Box component="section" sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h2" sx={{ fontSize: 20, fontWeight: 700 }}>
          Items need to order now
        </Typography>
        {pending.length > 0 && (
          <Box
            component="span"
            sx={{ ...PILL_SX, py: 0.25, bgcolor: TOKENS.warnBg, color: TOKENS.warn }}
          >
            {pending.length}
          </Box>
        )}
      </Stack>

      <Box
        component="form"
        onSubmit={submit}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <TextField
          select
          label="Category"
          size="small"
          value={category}
          onChange={(e) => changeCategory(e.target.value as OrderCategory)}
          sx={{ ...FIELD_SX, minWidth: 190, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
        >
          {choices.map((c) => (
            <MenuItem key={c.key} value={c.key}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        {info.needsName && (
          <SuggestField
            label="Name"
            value={name}
            options={suggestionsFor(all, category, "name")}
            onChange={(v) => {
              setName(v);
              setNameError(undefined);
            }}
            error={nameError}
          />
        )}
        {info.variant && (
          <SuggestField
            label={info.variant.label}
            value={variant}
            options={suggestionsFor(all, category, "variant")}
            onChange={setVariant}
          />
        )}
        <TextField
          label="Quantity"
          size="small"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          sx={{ ...FIELD_SX, width: 120 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={create.isPending}
          sx={{ height: 40 }}
        >
          Add
        </Button>
      </Box>

      <QueryStates
        status={status}
        isEmpty={pending.length === 0}
        emptyMessage="Nothing to order right now"
      >
        {ORDER_CATEGORIES.map((c) => {
          const rows = pending.filter((i) => i.category === c.key);
          if (rows.length === 0) return null;
          return (
            <Box key={c.key} sx={{ mb: 1.5 }}>
              <Typography
                component="h3"
                sx={{ ...CAPTION_SX, textTransform: "uppercase", mb: 0.5 }}
              >
                {c.label}
              </Typography>
              {rows.map((i) => (
                <Stack
                  key={i.id}
                  direction="row"
                  alignItems="center"
                  sx={{ borderBottom: LINE, py: 0.25 }}
                >
                  <Checkbox
                    size="small"
                    inputProps={{ "aria-label": `Mark ${orderItemLabel(i)} as ordered` }}
                    checked={false}
                    disabled={markOrdered.isPending}
                    onChange={() => ordered(i)}
                  />
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>
                    {orderItemLabel(i)}
                  </Typography>
                  {i.quantity && (
                    <Typography sx={{ color: TOKENS.muted, fontSize: 14, mr: 1 }}>
                      × {i.quantity}
                    </Typography>
                  )}
                  <IconButton
                    size="small"
                    aria-label={`Remove ${orderItemLabel(i)}`}
                    onClick={() => del(i)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Box>
          );
        })}
      </QueryStates>
    </Box>
  );
}
