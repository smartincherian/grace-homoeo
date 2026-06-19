import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { ensureUserDoc } from "./ensureUserDoc";
import { useToast } from "../../components/useToast";
import Mandala from "../../components/Mandala";

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
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        p: 2,
        background:
          "radial-gradient(120% 120% at 50% -20%, #15307A 0%, #101C57 45%, #0B1442 100%)",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 380, overflow: "hidden" }}>
        <Box
          sx={{
            position: "relative",
            bgcolor: "primary.main",
            color: "#EAF1FF",
            px: 3,
            py: 3.5,
            overflow: "hidden",
          }}
        >
          <Mandala
            size={120}
            color="#7FB4FF"
            opacity={0.2}
            sx={{ position: "absolute", top: -30, right: -20 }}
          />
          <Typography variant="h5" sx={{ position: "relative", color: "#fff" }}>
            Grace Homoeo
          </Typography>
          <Typography
            variant="body2"
            sx={{ position: "relative", opacity: 0.8 }}
          >
            Clinic sign-in
          </Typography>
        </Box>
        <CardContent component="form" onSubmit={submit} sx={{ p: 3 }}>
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
            fullWidth
            required
            sx={{ mb: 3 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" fullWidth disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
