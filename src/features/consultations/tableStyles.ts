// src/features/consultations/tableStyles.ts
// Shared look for the LSMC and generals tables.
import { TOKENS } from "../../theme/theme";

// Columns hidden on phones so the table fits without sideways scrolling.
export const WIDE_ONLY = { display: { xs: "none", sm: "table-cell" } };

// Muted heads (from the theme), roomy top-aligned rows, hairline dividers.
export function tableSx(clickable: boolean) {
  return {
    "& th": { py: 1.5 },
    "& td": { py: 1.5, verticalAlign: "top" },
    "& th:first-of-type, & td:first-of-type": { pl: 2.75 },
    "& th:last-of-type, & td:last-of-type": { pr: 2.75 },
    "& tbody tr:last-of-type td": { borderBottom: 0 },
    ...(clickable && {
      "& tbody tr": { cursor: "pointer" },
      "& tbody tr:hover": { bgcolor: "#f7f9ff !important" },
    }),
  };
}

// Sub-heading row (Menstrual, Perspiration, History) inside the generals tables.
export const GROUP_ROW_SX = {
  fontSize: 12,
  fontWeight: 700,
  color: TOKENS.blue700,
  bgcolor: TOKENS.blue50,
};
