import { ReactNode } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { TOKENS } from "../theme/theme";

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
        <CircularProgress size={28} />
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
      <Box sx={{ py: 7, textAlign: "center" }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "14px",
            bgcolor: TOKENS.blue50,
            mx: "auto",
            mb: 1.5,
          }}
        />
        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{emptyMessage}</Typography>
      </Box>
    );
  }
  return <>{children}</>;
}
