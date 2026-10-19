import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { useAuth } from "./useAuth";
import { auth } from "../../lib/firebase";
import { hasAccess } from "../../lib/access";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  // Re-checked per session so an account removed from the allow list is signed out.
  const access = useQuery({
    queryKey: ["access", user?.uid],
    queryFn: () => hasAccess(user!),
    enabled: !!user,
    staleTime: Infinity,
  });
  const denied = access.data === false;

  useEffect(() => {
    if (denied) void signOut(auth);
  }, [denied]);

  if (loading || (user && !access.data && !denied)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  return user && !denied ? <>{children}</> : <Navigate to="/login" replace />;
}
