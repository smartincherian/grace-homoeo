import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "../../lib/firebase";
import { getMembership, homePath } from "../../lib/access";
import { ensureUserDoc } from "./ensureUserDoc";
import { useToast } from "../../components/useToast";
import { TOKENS } from "../../theme/theme";
import BottomDock from "../../components/BottomDock";
import ProductMark from "../../components/ProductMark";

// Closing the Google popup is not an error worth reporting.
const CANCELLED = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

function GoogleMark() {
  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      sx={{ width: 18, height: 18 }}
      aria-hidden
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Box>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  /** Signs in, then lets the user through only if their email is allowed. */
  const signIn = async (
    attempt: () => Promise<UserCredential>,
    failMessage: string,
  ) => {
    setBusy(true);
    try {
      const { user } = await attempt();
      if (!user.emailVerified) {
        // Rules need a verified email; guide them instead of denying.
        navigate("/verify-email", { replace: true });
        return;
      }
      const membership = await getMembership(user);
      if (!membership) {
        await signOut(auth);
        showToast(
          `${user.email ?? "This account"} is not allowed to sign in.`,
          "error",
        );
        return;
      }
      queryClient.setQueryData(["access", user.uid], membership);
      await ensureUserDoc(user);
      navigate(homePath(membership), { replace: true });
    } catch (err) {
      if (!(err instanceof FirebaseError && CANCELLED.includes(err.code))) {
        showToast(failMessage, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const createAccount = async () => {
    setBusy(true);
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      // The account exists now; a failed send is recoverable via Resend.
      let justSent = true;
      try {
        await sendEmailVerification(user);
      } catch {
        justSent = false;
      }
      navigate("/verify-email", { replace: true, state: { justSent } });
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      showToast(
        code === "auth/email-already-in-use"
          ? "An account already exists for this email. Sign in or reset your password."
          : code === "auth/weak-password"
            ? "Password must be at least 6 characters."
            : code === "auth/invalid-email"
              ? "Enter a valid email address."
              : "Could not create the account. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) {
      void createAccount();
      return;
    }
    void signIn(
      () => signInWithEmailAndPassword(auth, email, password),
      "Login failed. Check your email and password, or reset your password.",
    );
  };

  /**
   * Emails a reset link. Also how a Google-only account gets its password
   * back: Firebase drops an unverified password when Google signs in.
   */
  const resetPassword = async () => {
    const target = email.trim();
    if (!target) {
      showToast("Enter your email above, then tap Forgot password.", "info");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, target);
      // Same message whether or not the account exists, to avoid leaking it.
      showToast(
        `If ${target} has an account, a reset link is on its way.`,
        "success",
      );
    } catch (err) {
      showToast(
        err instanceof FirebaseError && err.code === "auth/invalid-email"
          ? "Enter a valid email address."
          : "Could not send the reset email. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = () =>
    void signIn(
      () => signInWithPopup(auth, new GoogleAuthProvider()),
      "Google sign-in failed. Please try again.",
    );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        p: 2,
        bgcolor: "background.default",
        backgroundImage: `radial-gradient(60% 50% at 50% 0%, ${TOKENS.blue100} 0%, transparent 70%)`,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 400,
          my: "auto",
          borderRadius: "24px",
          boxShadow: "0 24px 60px rgba(20,26,46,.10)",
        }}
      >
        <CardContent
          component="form"
          onSubmit={submit}
          sx={{ p: { xs: 3, sm: 4 } }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3.5 }}
          >
            <ProductMark />
            <Box>
              <Typography variant="h1" sx={{ fontSize: 22 }}>
                HomoeoDesk
              </Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                Homoeo Clinic Manager
              </Typography>
            </Box>
          </Box>
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            sx={{ mb: 2 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            fullWidth
            required
            sx={{ mb: 1 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Box sx={{ textAlign: "right", mb: 2 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              Forgot password?
            </Link>
          </Box>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={busy}
          >
            {creating
              ? busy
                ? "Creating..."
                : "Create account"
              : busy
                ? "Signing in..."
                : "Sign In"}
          </Button>
          <Box sx={{ textAlign: "center", mt: 1.5 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              disabled={busy}
              onClick={() => setCreating((c) => !c)}
            >
              {creating ? "Have an account? Sign in" : "Create account"}
            </Link>
          </Box>
          <Divider sx={{ my: 2.5, fontSize: 13, color: "text.secondary" }}>
            or
          </Divider>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            disabled={busy}
            onClick={signInWithGoogle}
            startIcon={<GoogleMark />}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
      <Box sx={{ width: "100%", maxWidth: 880 }}>
        <BottomDock pinned={false} />
      </Box>
    </Box>
  );
}
