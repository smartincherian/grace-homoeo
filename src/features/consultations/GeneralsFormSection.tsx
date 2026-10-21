// src/features/consultations/GeneralsFormSection.tsx
import { Box, TextField, Typography } from "@mui/material";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { fieldHistory } from "./caseRecordRepo";
import type { GeneralsRecord } from "./caseRecordSchema";
import FieldHistoryCell from "./FieldHistoryCell";
import { generalsGroupsFor } from "./generalsFields";
import { dateInputToMs, msToDateInput } from "../../lib/dates";
import { TOKENS } from "../../theme/theme";

interface Props<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  showMenstrual: boolean;
  /** Earlier visits' generals, newest first (read-only history). */
  history: GeneralsRecord[];
  /** False hides the homoeo-only fields (their form values are kept). */
  homoeo?: boolean;
}

// Field | Present / history | This visit — stacked on phones.
const ROW_GRID = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "150px 1fr 1fr" },
  columnGap: 2,
  rowGap: 0.75,
  alignItems: "start",
  py: 1.25,
  borderBottom: 1,
  borderColor: "divider",
};

const HEAD_SX = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "text.secondary",
};

/**
 * Generals for this visit, bound to `generals.<key>`. Inputs start empty —
 * blank means "no change" — beside each field's earlier values.
 */
export default function GeneralsFormSection<T extends FieldValues>({
  control,
  register,
  showMenstrual,
  history,
  homoeo = true,
}: Props<T>) {
  return (
    <Box>
      <Box
        sx={{
          ...ROW_GRID,
          display: { xs: "none", sm: "grid" },
          py: 1,
          bgcolor: TOKENS.blue50,
          borderRadius: "10px",
          px: 1,
        }}
      >
        <Typography sx={HEAD_SX}>Field</Typography>
        <Typography sx={HEAD_SX}>Present / history</Typography>
        <Typography sx={HEAD_SX}>This visit (if new)</Typography>
      </Box>
      {generalsGroupsFor(homoeo)
        .filter((g) => showMenstrual || !g.menstrual)
        .map((group, gi) => (
          <Box key={group.title ?? gi}>
            {group.title && (
              <Typography
                variant="subtitle2"
                color="primary"
                sx={{ fontWeight: 700, pt: 2, pb: 0.5, px: 1 }}
              >
                {group.title}
              </Typography>
            )}
            {group.fields.map((f) => {
              const name = `generals.${f.key}` as Path<T>;
              const label = f.formLabel ?? f.label;
              return (
                <Box key={f.key} sx={{ ...ROW_GRID, px: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14, pt: 1 }}>
                    {f.label}
                  </Typography>
                  <Box sx={{ pt: { sm: 1 } }}>
                    <FieldHistoryCell entries={fieldHistory(history, f.key)} />
                  </Box>
                  {f.key === "lmp" ? (
                    <Controller
                      name={name}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          size="small"
                          type="date"
                          fullWidth
                          inputProps={{ "aria-label": label }}
                          value={field.value ? msToDateInput(field.value) : ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? dateInputToMs(e.target.value)
                                : null,
                            )
                          }
                        />
                      )}
                    />
                  ) : (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      placeholder="No change"
                      inputProps={{ "aria-label": label }}
                      {...register(name)}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
    </Box>
  );
}
