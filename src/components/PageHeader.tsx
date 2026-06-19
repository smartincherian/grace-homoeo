import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="h5">{title}</Typography>
      {action}
    </Stack>
  );
}
