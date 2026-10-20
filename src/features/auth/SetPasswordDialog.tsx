import { useState } from "react";
import {
  EmailAuthProvider,
  linkWithCredential,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useToast } from "../../components/useToast";

/** True when the account can already sign in with email + password. */
export const hasPassword = (user: User) =>
  (user.providerData ?? []).some((p) => p.providerId === "password");

const ERRORS: Record<string, string> = {
  "auth/requires-recent-login":
    "For security, sign out and sign in again, then set the password.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/provider-already-linked": "This account already has a password.",
  "auth/credential-already-in-use":
    "This email's password is already used by another account.",
};

interface Props {
  open: boolean;
  user: User;
  onClose: () => void;
}

/**
 * Adds an email/password sign-in to an account that only has Google, so the
 * same email works on the login form too (Google sign-in stays linked).
 */
export default function SetPasswordDialog({ open, user, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (!user.email) return setError("This account has no email address.");
    setError("");
    setBusy(true);
    try {
      await linkWithCredential(
        user,
        EmailAuthProvider.credential(user.email, password),
      );
      showToast("Password set. You can now sign in with email too.", "success");
      onClose();
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      showToast(
        ERRORS[code] ?? "Could not set the password. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Set a password</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Lets you sign in as {user.email} with a password as well as Google.
          </DialogContentText>
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            fullWidth
            sx={{ mb: 2 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            fullWidth
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={!!error}
            helperText={error || " "}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving..." : "Set password"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
