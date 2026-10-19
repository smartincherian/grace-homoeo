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
import { TOKENS } from "../../theme/theme";
import ScriptureBanner from "../../components/ScriptureBanner";

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
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "14px",
                background: "linear-gradient(135deg,#4f86ff,#2f6bff)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 19,
              }}
            >
              G
            </Box>
            <Box>
              <Typography variant="h1" sx={{ fontSize: 22 }}>
                Grace Homoeo
              </Typography>
              <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                Clinic sign-in
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
            fullWidth
            required
            sx={{ mb: 3 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={busy}
          >
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
      <Box sx={{ width: "100%", maxWidth: 880 }}>
        <ScriptureBanner pinned={false} />
      </Box>
    </Box>
  );
}
