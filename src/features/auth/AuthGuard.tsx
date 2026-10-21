import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
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
    enabled: !!user && user.emailVerified,
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

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (user && access.isError && !access.data && !denied) {
    return (
      <Box sx={{ textAlign: "center", mt: 8, px: 2 }}>
        <Typography sx={{ mb: 2 }}>
          Couldn't check your access. Check your connection.
        </Typography>
        <Button variant="contained" onClick={() => void access.refetch()}>
          Retry
        </Button>
      </Box>
    );
  }
  if (loading || (user && !access.data && !denied)) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (user && access.data?.inactive) {
    return (
      <Box sx={{ textAlign: "center", mt: 8, px: 2 }}>
        <Typography variant="h2" sx={{ fontSize: 20, fontWeight: 700, mb: 1 }}>
          {access.data.inactive === "clinic"
            ? "This clinic is inactive."
            : "Your access to this clinic has been turned off."}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Please contact the administrator to turn it back on.
        </Typography>
        <Button variant="contained" onClick={() => void signOut(auth)}>
          Sign out
        </Button>
      </Box>
    );
  }
  return user && !denied ? <>{children}</> : <Navigate to="/login" replace />;
}
