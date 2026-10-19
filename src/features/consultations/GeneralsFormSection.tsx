// src/features/consultations/GeneralsFormSection.tsx
import { Box, Stack, TextField, Typography } from "@mui/material";
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { GENERALS_GROUPS } from "./generalsFields";
import { dateInputToMs, msToDateInput } from "../../lib/dates";

interface Props<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  showMenstrual: boolean;
}

/** Generals inputs, bound to `generals.<key>` of the consultation form. */
export default function GeneralsFormSection<T extends FieldValues>({
  control,
  register,
  showMenstrual,
}: Props<T>) {
  return (
    <Stack spacing={2}>
      {GENERALS_GROUPS.filter((g) => showMenstrual || !g.menstrual).map(
        (group, gi) => (
          <Box key={group.title ?? gi}>
            {group.title && (
              <Typography
                variant="subtitle2"
                color="primary"
                sx={{ fontWeight: 700, mb: 1 }}
              >
                {group.title}
              </Typography>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              {group.fields.map((f) => {
                const name = `generals.${f.key}` as Path<T>;
                const label = f.formLabel ?? f.label;
                return f.key === "lmp" ? (
                  <Controller
                    key={f.key}
                    name={name}
                    control={control}
                    render={({ field }) => (
                      <TextField
                        label={label}
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
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
                    key={f.key}
                    label={label}
                    fullWidth
                    multiline
                    minRows={1}
                    InputLabelProps={{ shrink: true }}
                    {...register(name)}
                  />
                );
              })}
            </Box>
          </Box>
        ),
      )}
    </Stack>
  );
}
