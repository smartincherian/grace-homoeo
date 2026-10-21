import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../../lib/firebase";
import { getAccess, homePath } from "../../lib/access";
import { ensureUserDoc } from "../../lib/ensureUserDoc";
import { useAuth } from "./useAuth";
import { useToast } from "../../components/useToast";
import ProductMark from "../../components/ProductMark";
import { CARD_SX, TOKENS } from "../../theme/theme";

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const autoSent = useRef(false);

  // Sign-in and saved-session paths land here without having sent anything.
  useEffect(() => {
    if (loading || !user || autoSent.current) return;
    autoSent.current = true;
    if ((location.state as { justSent?: boolean } | null)?.justSent === true)
      return;
    sendEmailVerification(user).catch(() => {
      // Silent: the copy tells them to check their inbox or resend.
    });
  }, [loading, user, location.state]);

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
        const access = await getAccess(user);
        if (access === "signup") {
          queryClient.setQueryData(["access", user.uid], access);
          navigate("/setup", { replace: true });
          return;
        }
        if (!access) {
          showToast(
            `${user.email ?? "This account"} is not allowed to sign in.`,
            "error",
          );
          await signOut(auth);
          navigate("/login", { replace: true });
          return;
        }
        queryClient.setQueryData(["access", user.uid], access);
        await ensureUserDoc(user);
        navigate(homePath(access), { replace: true });
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <ProductMark size={40} />
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                Homoeo Desk
              </Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                Homoeo Clinic Manager
              </Typography>
            </Box>
          </Box>
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
