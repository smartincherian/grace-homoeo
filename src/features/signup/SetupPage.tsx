import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "../../lib/firebase";
import { getAccess, homePath } from "../../lib/access";
import { isValidSlug, slugify } from "../../lib/clinic";
import { useAuth } from "../auth/useAuth";
import { ensureUserDoc } from "../../lib/ensureUserDoc";
import { useToast } from "../../components/useToast";
import ProductMark from "../../components/ProductMark";
import BottomDock from "../../components/BottomDock";
import { CARD_SX, TOKENS } from "../../theme/theme";
import { CLINIC_TYPES, type ClinicType } from "../../lib/clinicType";
import { createOwnClinic, isSlugTaken } from "./signupRepo";

export default function SetupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [type, setType] = useState<ClinicType>("homoeo");
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  // Live availability of `slug`: checked a moment after typing stops.
  const [avail, setAvail] = useState<{
    slug: string;
    state: "free" | "taken" | "error";
  } | null>(null);

  const access = useQuery({
    queryKey: ["access", user?.uid],
    queryFn: () => getAccess(user!),
    enabled: !!user && user.emailVerified,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isValidSlug(slug)) return;
    let stale = false;
    const t = setTimeout(() => {
      isSlugTaken(slug).then(
        (isTaken) => {
          if (!stale) setAvail({ slug, state: isTaken ? "taken" : "free" });
        },
        () => {
          if (!stale) setAvail({ slug, state: "error" });
        },
      );
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [slug]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  // Not while submitting: the success path sets access, then goes to settings.
  if (!busy && typeof access.data === "object" && access.data !== null)
    return <Navigate to={homePath(access.data)} replace />;

  const email = user.email ?? "";
  const slugOk = isValidSlug(slug);
  const slugError = !slug ? false : !slugOk;
  const state = avail?.slug === slug ? avail.state : "checking";
  const isTaken = taken || (slugOk && state === "taken");
  const canSubmit =
    name.trim().length > 0 &&
    slugOk &&
    !busy &&
    !isTaken &&
    state !== "checking";

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
        await createOwnClinic(slug, name.trim(), email, type);
      } catch (err) {
        console.error(err);
        showToast(
          "Couldn't create the clinic. Check your phone's date and time, then try again.",
          "error",
        );
        return;
      }
      try {
        const fresh = await getAccess(user);
        queryClient.setQueryData(["access", user.uid], fresh);
        await ensureUserDoc(user);
      } catch (err) {
        // The clinic exists now; re-resolve access so the page redirects home
        // instead of leaving the user here with "slug taken" on a retry.
        console.error(err);
        void queryClient.invalidateQueries({ queryKey: ["access", user.uid] });
        showToast("Something went wrong. Please try again.", "error");
        return;
      }
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
        flexDirection: "column",
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
            Register your clinic for free
          </Typography>
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
              error={slugError || isTaken}
              helperText={
                !slug
                  ? "Filled in from the clinic name; you can change it"
                  : slugError
                    ? "3–40 letters, numbers or dashes"
                    : isTaken
                      ? "✗ That web address is taken, try another"
                      : state === "free"
                        ? "✓ Available"
                        : state === "error"
                          ? "Couldn't check right now; we'll check when you register"
                          : "Checking…"
              }
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0 }}>
                      homoeodesk.web.app/
                    </InputAdornment>
                  ),
                },
                formHelperText: {
                  sx: {
                    color:
                      !slugError && !isTaken && state === "free"
                        ? TOKENS.ok
                        : undefined,
                  },
                },
              }}
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              select
              label="Clinic type"
              value={type}
              onChange={(e) => setType(e.target.value as ClinicType)}
              fullWidth
              sx={{ mb: 2 }}
            >
              {CLINIC_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
              Free for 21 days, no payment needed.
            </Typography>
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={!canSubmit}
              sx={{ mb: 1.5 }}
            >
              Register for free
            </Button>
          </Box>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Button onClick={() => void signOutNow()}>Sign out</Button>
          </Box>
        </CardContent>
      </Card>
      <BottomDock pinned={false} showScripture={false} />
    </Box>
  );
}
