import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MedicationLiquidIcon from "@mui/icons-material/MedicationLiquid";
import QueryStates from "../../components/QueryStates";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { GRADIENT } from "../../theme/theme";
import { useToast } from "../../components/useToast";
import { usePricedItems } from "./useCalculator";
import {
  baseQuantity,
  lineCost,
  DISPENSE_DEFAULTS,
  DEFAULT_FEE,
  type DispenseInputs,
  type LiquidMode,
} from "./calculatorMath";

interface Line {
  key: string;
  itemId: string;
  inputs: DispenseInputs;
}

const rupees = (n: number) => `₹${n.toFixed(2)}`;

/** Compact numeric field that mirrors the project's controlled-number pattern. */
function NumField({
  label,
  value,
  onChange,
  width = 110,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  width?: number;
}) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      sx={{ width }}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? 0 : Number(e.target.value))
      }
    />
  );
}

/**
 * Number input for the gradient summary cards. The label sits above the box as
 * plain text — an outlined floating label would straddle the white input and
 * the gradient and become unreadable.
 */
function GradientField({
  label,
  value,
  onChange,
  width = 130,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  width?: number;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        {label}
      </Typography>
      <TextField
        type="number"
        size="small"
        sx={{ width }}
        inputProps={{ "aria-label": label }}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
      />
    </Stack>
  );
}

const gradientCardSx = {
  background: GRADIENT,
  color: "#fff",
  border: 0,
  "& .MuiTypography-root": { color: "inherit" },
  "& .MuiOutlinedInput-root": { bgcolor: "#fff" },
} as const;

/** Change to return: money handed over by the patient minus the bill. */
function BalanceCard() {
  const [given, setGiven] = useState(0);
  const [incurred, setIncurred] = useState(0);
  const balance = given - incurred;
  return (
    <Card sx={gradientCardSx}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Balance
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <GradientField
            label="Money given (₹)"
            value={given}
            onChange={setGiven}
          />
          <GradientField
            label="Amount incurred (₹)"
            value={incurred}
            onChange={setIncurred}
          />
        </Stack>
        <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,.3)" }} />
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="body2">
            {balance < 0 ? "Still to collect" : "Balance to return"}
          </Typography>
          <Box
            sx={{
              px: 2,
              py: 0.5,
              borderRadius: 2,
              bgcolor: "#fff",
              color: balance < 0 ? "error.main" : "primary.main",
            }}
          >
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: "inherit !important" }}
            >
              {rupees(Math.abs(balance))}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function CalculatorPage() {
  useSetPageTitle("Calculator");
  const { status, data } = usePricedItems();
  const { showToast } = useToast();
  const items = useMemo(() => data ?? [], [data]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const nextKey = useRef(0);
  const makeLine = (itemId = ""): Line => ({
    key: `line-${nextKey.current++}`,
    itemId,
    inputs: { ...DISPENSE_DEFAULTS },
  });

  const [lines, setLines] = useState<Line[]>([makeLine()]);
  const [fee, setFee] = useState<number>(DEFAULT_FEE);

  const patchInputs = (key: string, patch: Partial<DispenseInputs>) =>
    setLines((ls) =>
      ls.map((l) =>
        l.key === key ? { ...l, inputs: { ...l.inputs, ...patch } } : l,
      ),
    );
  const setItem = (key: string, itemId: string) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, itemId } : l)));
  const removeLine = (key: string) =>
    setLines((ls) => ls.filter((l) => l.key !== key));

  const addBottle = () => {
    const bottle = items.find((i) => i.form === "packaging");
    if (!bottle) {
      showToast(
        "Add an empty-bottle item (with cost) to inventory first.",
        "info",
      );
      return;
    }
    setLines((ls) => [...ls, makeLine(bottle.id)]);
  };

  const costOf = (line: Line): number => {
    const item = itemById.get(line.itemId);
    if (!item) return 0;
    return lineCost(item.form, item.unitCost, line.inputs);
  };

  const total = lines.reduce((sum, l) => sum + costOf(l), 0);
  const margin = fee - total;

  return (
    <Box sx={{ maxWidth: 720, pb: 2 }}>
      <PageHeader
        title="Calculator"
        subtitle="Work out the change to return, and estimate the medicine cost for one patient — nothing is saved."
      />

      <Box sx={{ mb: 2 }}>
        <BalanceCard />
      </Box>

      <QueryStates
        status={status}
        isEmpty={items.length === 0}
        emptyMessage="Add purchase cost to inventory items to use the calculator."
      >
        <Stack spacing={2}>
          {lines.map((line) => {
            const item = itemById.get(line.itemId);
            const qty = item ? baseQuantity(item.form, line.inputs) : 0;
            const cost = costOf(line);
            return (
              <Card key={line.key}>
                <CardContent>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: item ? 2 : 0 }}
                  >
                    <TextField
                      select
                      label="Medicine / item"
                      size="small"
                      fullWidth
                      value={line.itemId}
                      onChange={(e) => setItem(line.key, e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Select…</em>
                      </MenuItem>
                      {items.map((i) => (
                        <MenuItem key={i.id} value={i.id}>
                          {i.name} ({rupees(i.unitCost)}/{i.baseUnit})
                        </MenuItem>
                      ))}
                    </TextField>
                    <IconButton
                      aria-label="Remove line"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Stack>

                  {item && (
                    <>
                      {item.form === "pieces" && (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <NumField
                            label="Times / day"
                            value={line.inputs.timesPerDay}
                            onChange={(n) =>
                              patchInputs(line.key, { timesPerDay: n })
                            }
                          />
                          <NumField
                            label="Pills / dose"
                            value={line.inputs.pillsPerDose}
                            onChange={(n) =>
                              patchInputs(line.key, { pillsPerDose: n })
                            }
                          />
                          <NumField
                            label="Days"
                            value={line.inputs.days}
                            onChange={(n) => patchInputs(line.key, { days: n })}
                          />
                        </Stack>
                      )}

                      {item.form === "liquid" && (
                        <Stack spacing={1.5}>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={line.inputs.liquidMode}
                            onChange={(_, v: LiquidMode | null) =>
                              v && patchInputs(line.key, { liquidMode: v })
                            }
                          >
                            <ToggleButton value="drops">By drops</ToggleButton>
                            <ToggleButton value="fixed">
                              Fixed volume
                            </ToggleButton>
                          </ToggleButtonGroup>
                          {line.inputs.liquidMode === "drops" ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <NumField
                                label="Drops / dose"
                                value={line.inputs.dropsPerDose}
                                onChange={(n) =>
                                  patchInputs(line.key, { dropsPerDose: n })
                                }
                              />
                              <NumField
                                label="Times / day"
                                value={line.inputs.timesPerDay}
                                onChange={(n) =>
                                  patchInputs(line.key, { timesPerDay: n })
                                }
                              />
                              <NumField
                                label="Days"
                                value={line.inputs.days}
                                onChange={(n) =>
                                  patchInputs(line.key, { days: n })
                                }
                              />
                              <NumField
                                label="Drops / ml"
                                value={line.inputs.dropsPerMl}
                                onChange={(n) =>
                                  patchInputs(line.key, { dropsPerMl: n })
                                }
                              />
                            </Stack>
                          ) : (
                            <NumField
                              label="Volume (ml)"
                              value={line.inputs.ml}
                              onChange={(n) => patchInputs(line.key, { ml: n })}
                            />
                          )}
                        </Stack>
                      )}

                      {(item.form === "packaging" || item.form === "flat") && (
                        <NumField
                          label="Quantity"
                          value={line.inputs.quantity}
                          onChange={(n) =>
                            patchInputs(line.key, { quantity: n })
                          }
                        />
                      )}

                      <Typography
                        variant="body2"
                        sx={{ mt: 2, fontWeight: 600 }}
                      >
                        {+qty.toFixed(2)} {item.baseUnit}
                        {qty === 1 ? "" : "s"} × {rupees(item.unitCost)} ={" "}
                        <Box component="span" sx={{ color: "primary.main" }}>
                          {rupees(cost)}
                        </Box>
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setLines((ls) => [...ls, makeLine()])}
            >
              Add medicine
            </Button>
            <Button startIcon={<MedicationLiquidIcon />} onClick={addBottle}>
              Add bottle
            </Button>
          </Stack>

          <Card sx={gradientCardSx}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6">Medicine cost</Typography>
                <Typography variant="h6">{rupees(total)}</Typography>
              </Stack>
              <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,.3)" }} />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-end"
              >
                <GradientField
                  label="Visit fee (₹)"
                  value={fee}
                  onChange={setFee}
                />
                <Stack alignItems="flex-end">
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Margin (fee − cost)
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 800,
                      color: margin < 0 ? "#ffd2db !important" : "inherit",
                    }}
                  >
                    {rupees(margin)}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </QueryStates>
    </Box>
  );
}
