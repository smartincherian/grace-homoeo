import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "../../lib/firebase";
import { getAccess, homePath } from "../../lib/access";
import { isValidSlug, slugify } from "../../lib/clinic";
import { pricingWhatsAppUrl } from "../../lib/subscription";
import { useAuth } from "../auth/useAuth";
import { ensureUserDoc } from "../auth/ensureUserDoc";
import { useToast } from "../../components/useToast";
import ProductMark from "../../components/ProductMark";
import BottomDock from "../../components/BottomDock";
import { CARD_SX, TOKENS } from "../../theme/theme";
import { createOwnClinic, isSlugTaken } from "./signupRepo";

export default function SetupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);

  const access = useQuery({
    queryKey: ["access", user?.uid],
    queryFn: () => getAccess(user!),
    enabled: !!user && user.emailVerified,
    staleTime: Infinity,
  });

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (typeof access.data === "object" && access.data !== null)
    return <Navigate to={homePath(access.data)} replace />;

  const email = user.email ?? "";
  const slugOk = isValidSlug(slug);
  const slugError = !slug ? false : !slugOk;
  const canSubmit = name.trim().length > 0 && slugOk && !busy;

  const onName = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
    setTaken(false);
  };
  const onSlug = (v: string) => {
    setSlugEdited(true);
    setSlug(v.toLowerCase());
    setTaken(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (await isSlugTaken(slug)) {
        setTaken(true);
        return;
      }
      try {
        await createOwnClinic(slug, name.trim(), email);
      } catch (err) {
        console.error(err);
        showToast(
          "Couldn't create the clinic. Check your phone's date and time, then try again.",
          "error",
        );
        return;
      }
      const fresh = await getAccess(user);
      queryClient.setQueryData(["access", user.uid], fresh);
      await ensureUserDoc(user);
      navigate(`/${slug}/settings`, { replace: true });
    } catch (err) {
      console.error(err);
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const signOutNow = async () => {
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
        sx={{ ...CARD_SX, width: "100%", maxWidth: 440, borderRadius: "24px" }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <ProductMark size={40} />
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
              Homoeo Desk
            </Typography>
          </Box>
          <Typography variant="h1" sx={{ fontSize: 22, mb: 2 }}>
            Start your clinic on Homoeo Desk
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Joining a clinic that already uses Homoeo Desk? Don't create one —
            ask its owner to add {email} on their People page, then sign in
            again.
          </Alert>
          <Box component="form" onSubmit={(e) => void submit(e)}>
            <TextField
              label="Clinic name"
              value={name}
              onChange={(e) => onName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 60 } }}
              required
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              label="Web address"
              value={slug}
              onChange={(e) => onSlug(e.target.value)}
              error={slugError || taken}
              helperText={
                taken
                  ? "That web address is taken, try another"
                  : slugError
                    ? "3–40 letters, numbers or dashes"
                    : `homoeodesk.web.app/${slug}`
              }
              fullWidth
              sx={{ mb: 2 }}
            />
            <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
              21-day free trial, no payment needed.
            </Typography>
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={!canSubmit}
              sx={{ mb: 1.5 }}
            >
              Start free trial
            </Button>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button onClick={() => void signOutNow()}>Sign out</Button>
            <Link
              href={pricingWhatsAppUrl({
                clinicName: name.trim(),
                clinicId: slug,
                email,
              })}
              target="_blank"
              rel="noopener"
              sx={{ alignSelf: "center", fontSize: 14 }}
            >
              Pricing? Ask on WhatsApp
            </Link>
          </Box>
        </CardContent>
      </Card>
      <BottomDock pinned={false} showScripture={false} />
    </Box>
  );
}
