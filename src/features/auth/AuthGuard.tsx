import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./useAuth";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
