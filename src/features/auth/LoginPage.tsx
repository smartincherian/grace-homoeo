import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { ensureUserDoc } from "./ensureUserDoc";
import { useToast } from "../../components/useToast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      navigate("/patients", { replace: true });
    } catch {
      showToast("Login failed. Check your email and password.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 380 }}>
        <CardContent component="form" onSubmit={submit}>
          <Typography variant="h5" align="center" sx={{ mb: 3 }}>Grace Homoeo</Typography>
          <TextField label="Email" type="email" fullWidth required sx={{ mb: 2 }}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" fullWidth required sx={{ mb: 3 }}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="contained" fullWidth disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
