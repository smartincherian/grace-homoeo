// src/features/consultations/LsmcEditor.tsx
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { LINE, TOKENS } from "../../theme/theme";

const COLUMNS = [
  { key: "location", label: "Location" },
  { key: "sensation", label: "Sensation" },
  { key: "modality", label: "Modality" },
  { key: "concomitant", label: "Concomitant" },
] as const;

// Four equal columns + the remove button on wider screens; stacked on phones.
const ROW_GRID = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr 1fr 40px" },
  gap: 1,
  alignItems: "start",
};

interface Props<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
}

/** Editable LSMC rows bound to `lsmc` of the consultation form. */
export default function LsmcEditor<T extends FieldValues>({
  control,
  register,
}: Props<T>) {
  // keyName must not be "id": rows carry their Firestore id in `id`.
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lsmc" as FieldArrayPath<T>,
    keyName: "key",
  });

  return (
    <Stack spacing={1}>
      {fields.length > 0 && (
        <Box sx={{ ...ROW_GRID, display: { xs: "none", sm: "grid" }, px: 1.5 }}>
          {COLUMNS.map((c) => (
            <Typography
              key={c.key}
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              {c.label}
            </Typography>
          ))}
        </Box>
      )}
      {fields.map((field, i) => (
        <Box
          key={field.key}
          sx={{
            ...ROW_GRID,
            p: 1.5,
            borderRadius: "14px",
            border: LINE,
          }}
        >
          {COLUMNS.map((c) => (
            <Box key={c.key}>
              <Typography
                sx={{
                  display: { xs: "block", sm: "none" },
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "text.secondary",
                  mb: 0.5,
                }}
              >
                {c.label}
              </Typography>
              <TextField
                size="small"
                fullWidth
                multiline
                placeholder={c.label}
                inputProps={{ "aria-label": c.label }}
                {...register(`lsmc.${i}.${c.key}` as Path<T>)}
              />
            </Box>
          ))}
          <IconButton
            aria-label="Remove row"
            onClick={() => remove(i)}
            sx={{ justifySelf: { xs: "end", sm: "center" } }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button
          startIcon={<AddIcon />}
          fullWidth
          sx={{
            border: `1.5px dashed ${TOKENS.blue200}`,
            color: TOKENS.blue700,
            justifyContent: "flex-start",
            "&:hover": { bgcolor: TOKENS.blue50 },
          }}
          onClick={() =>
            append({
              location: "",
              sensation: "",
              modality: "",
              concomitant: "",
            } as never)
          }
        >
          Add row
        </Button>
      </Box>
    </Stack>
  );
}
