import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { useAuth } from "./useAuth";
import { auth } from "../../lib/firebase";
import { getMembership, type Membership } from "../../lib/access";

/** The signed-in user's membership; re-checked per session so a removed account is signed out. */
function useMembershipQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["access", user?.uid],
    queryFn: () => getMembership(user!),
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: "always",
  });
}

/** The current membership (undefined while unresolved, or when there is none). */
export function useMembership(): Membership | undefined {
  return useMembershipQuery().data ?? undefined;
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const access = useMembershipQuery();
  const denied = access.data === null;

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
