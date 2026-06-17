import { ReactNode } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

interface Props {
  status: "pending" | "error" | "success";
  isError?: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export default function QueryStates({ status, isError, isEmpty, emptyMessage, children }: Props) {
  if (status === "pending") {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (status === "error" || isError) {
    return <Typography color="error" sx={{ py: 4, textAlign: "center" }}>Something went wrong. Please try again.</Typography>;
  }
  if (isEmpty) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>{emptyMessage}</Typography>;
  }
  return <>{children}</>;
}
