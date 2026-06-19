import { ReactNode } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import Mandala from "./Mandala";

interface Props {
  status: "pending" | "error" | "success";
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export default function QueryStates({
  status,
  isEmpty,
  emptyMessage,
  children,
}: Props) {
  if (status === "pending") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (status === "error") {
    return (
      <Typography color="error" sx={{ py: 4, textAlign: "center" }}>
        Something went wrong. Please try again.
      </Typography>
    );
  }
  if (isEmpty) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 7 }}>
        <Mandala size={84} color="#150E56" opacity={0.12} />
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Stack>
    );
  }
  return <>{children}</>;
}
