import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../../lib/firebase";
import { useAuth } from "./useAuth";
import { useToast } from "../../components/useToast";
import { CARD_SX, TOKENS } from "../../theme/theme";

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const resend = async () => {
    setBusy(true);
    try {
      await sendEmailVerification(user);
      showToast(`Verification email sent to ${user.email}.`, "success");
    } catch (err) {
      showToast(
        err instanceof FirebaseError && err.code === "auth/too-many-requests"
          ? "Please wait a minute before resending."
          : "Could not send the email. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      await user.reload();
      // Refresh the token so Firestore rules see email_verified == true.
      await user.getIdToken(true);
      if (auth.currentUser?.emailVerified) {
        // Drop any stale membership denial cached before verifying.
        queryClient.removeQueries({ queryKey: ["access"] });
        navigate("/", { replace: true });
      } else {
        showToast(
          "Not verified yet. Check your inbox and spam folder.",
          "info",
        );
      }
    } catch {
      showToast("Could not check verification. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        bgcolor: "background.default",
        backgroundImage: `radial-gradient(60% 50% at 50% 0%, ${TOKENS.blue100} 0%, transparent 70%)`,
      }}
    >
      <Card
        sx={{ ...CARD_SX, width: "100%", maxWidth: 400, borderRadius: "24px" }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h1" sx={{ fontSize: 22, mb: 1 }}>
            Verify your email
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 0.5 }}>
            We sent a verification link to
          </Typography>
          <Typography sx={{ fontWeight: 700, mb: 2, wordBreak: "break-all" }}>
            {user.email}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 3 }}>
            Open the link in that email, then come back and tap the button
            below.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={busy}
            onClick={() => void check()}
            sx={{ mb: 1.5 }}
          >
            I've verified
          </Button>
          <Button
            variant="outlined"
            fullWidth
            disabled={busy}
            onClick={() => void resend()}
            sx={{ mb: 1.5 }}
          >
            Resend email
          </Button>
          <Button
            fullWidth
            disabled={busy}
            onClick={() => void switchAccount()}
          >
            Use a different account
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
