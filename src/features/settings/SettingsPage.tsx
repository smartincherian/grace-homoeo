import { useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import ClinicMark from "../../components/ClinicMark";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { useToast } from "../../components/useToast";
import { useAuth } from "../auth/useAuth";
import { normalizeEmail } from "../../lib/access";
import { useClinic } from "../../lib/clinicQueries";
import { useBranding, useSaveBranding } from "../../lib/useBranding";
import { displayNameOf, type Branding, type Contact } from "../../lib/branding";
import { BRAND_PRESETS, ensureContrast } from "../../theme/brand";
import { CARD_SX, GRADIENT, TOKENS } from "../../theme/theme";
import { resizeLogo } from "./resizeLogo";

const NAME_MAX = 60;
const CONTACT_MAX = 120;

const CONTACT_FIELDS: { key: keyof Contact; label: string }[] = [
  { key: "doctorName", label: "Doctor name" },
  { key: "qualifications", label: "Qualifications" },
  { key: "registrationNo", label: "Registration no." },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 2.5 }}
    >
      <Typography variant="h2" sx={{ fontSize: 17, fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function SettingsPage() {
  useSetPageTitle("Settings");
  const { clinicSlug = "" } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const clinicName = useClinic(clinicSlug).data?.name;
  const brandingQuery = useBranding(clinicSlug);
  const saved = brandingQuery.data;
  const save = useSaveBranding(clinicSlug);
  const [draft, setDraft] = useState<Branding | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!saved && brandingQuery.isError) {
    return (
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          py: 8,
          gap: 2,
          textAlign: "center",
        }}
      >
        <Typography>
          Couldn&apos;t load settings. Check your connection.
        </Typography>
        <Button variant="outlined" onClick={() => void brandingQuery.refetch()}>
          Retry
        </Button>
      </Box>
    );
  }
  if (!saved) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  const b = draft ?? saved;
  const update = (patch: Partial<Branding>) =>
    setDraft((d) => ({ ...(d ?? saved), ...patch }));
  const updateContact = (key: keyof Contact, value: string) =>
    setDraft((d) => {
      const base = d ?? saved;
      return { ...base, contact: { ...base.contact, [key]: value } };
    });
  const effective = ensureContrast(b.primaryColor);
  const adjusted = effective !== b.primaryColor.toLowerCase();
  const nameTooLong = b.displayName.length > NAME_MAX;
  const contactTooLong = (k: keyof Contact) =>
    b.contact[k].length > CONTACT_MAX;
  const invalid =
    nameTooLong || CONTACT_FIELDS.some((f) => contactTooLong(f.key));
  const shownName = displayNameOf(b, clinicName);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const logoDataUrl = await resizeLogo(file);
      update({ logoDataUrl });
    } catch (e) {
      showToast(
        e instanceof Error && e.message === "too-large"
          ? "That image is too large."
          : "Choose a PNG, JPG or WebP image.",
        "error",
      );
    }
  };

  const onSave = () => {
    save.mutate(
      { branding: b, by: normalizeEmail(user?.email ?? "") },
      {
        onSuccess: () => {
          setDraft(null);
          showToast("Settings saved", "success");
        },
        onError: () =>
          showToast("Could not save settings. Please try again.", "error"),
      },
    );
  };

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="How your clinic appears in the app"
      />

      <Section title="Clinic name">
        <TextField
          label="Clinic name"
          size="small"
          fullWidth
          value={b.displayName}
          placeholder={clinicName}
          onChange={(e) => update({ displayName: e.target.value })}
          error={nameTooLong}
          helperText={
            nameTooLong ? "Keep the name under 60 characters." : undefined
          }
        />
      </Section>

      <Section title="Logo">
        <Stack
          direction="row"
          gap={2}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          <ClinicMark branding={b} name={shownName} size={64} />
          <Button variant="outlined" onClick={() => fileRef.current?.click()}>
            Upload logo
          </Button>
          {b.logoDataUrl && (
            <Button onClick={() => update({ logoDataUrl: "" })}>
              Remove logo
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            aria-label="Logo file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </Stack>
      </Section>

      <Section title="Colour">
        <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
          {BRAND_PRESETS.map((p) => (
            <Box
              key={p.hex}
              component="button"
              type="button"
              aria-label={p.label}
              aria-pressed={b.primaryColor.toLowerCase() === p.hex}
              onClick={() => update({ primaryColor: p.hex })}
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: p.hex,
                cursor: "pointer",
                border: "3px solid #fff",
                boxShadow:
                  b.primaryColor.toLowerCase() === p.hex
                    ? `0 0 0 2px ${TOKENS.ink}`
                    : `0 0 0 1px ${TOKENS.line}`,
              }}
            />
          ))}
          <Box
            component="input"
            type="color"
            aria-label="Custom colour"
            value={b.primaryColor}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              update({ primaryColor: e.target.value })
            }
            sx={{
              width: 44,
              height: 36,
              p: 0,
              border: 0,
              bgcolor: "transparent",
            }}
          />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <Box
            data-testid="colour-preview"
            sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: effective }}
            style={{ backgroundColor: effective }}
          />
          <Box
            sx={{
              bgcolor: effective,
              color: "#fff",
              px: 2,
              py: 0.75,
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Primary button
          </Box>
          <Box
            aria-hidden
            sx={{
              width: 36,
              height: 36,
              borderRadius: "11px",
              background: `linear-gradient(160deg, ${effective}, ${effective}bb)`,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
            }}
          >
            {shownName.charAt(0).toUpperCase()}
          </Box>
        </Stack>
        {adjusted && (
          <Typography sx={{ fontSize: 13, color: TOKENS.warn, mt: 1 }}>
            Adjusted for readability ({effective})
          </Typography>
        )}
      </Section>

      <Section title="Scripture banner">
        <FormControlLabel
          control={
            <Switch
              checked={b.showScripture}
              onChange={(e) => update({ showScripture: e.target.checked })}
            />
          }
          label="Show scripture banner"
        />
      </Section>

      <Section title="Contact details">
        <Stack spacing={1.5}>
          {CONTACT_FIELDS.map(({ key, label }) => (
            <TextField
              key={key}
              label={label}
              size="small"
              fullWidth
              value={b.contact[key]}
              onChange={(e) => updateContact(key, e.target.value)}
              error={contactTooLong(key)}
              helperText={
                contactTooLong(key)
                  ? "Keep this under 120 characters."
                  : undefined
              }
            />
          ))}
        </Stack>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 1.5 }}>
          Stored for future printing.
        </Typography>
      </Section>

      <Box
        sx={{
          position: "sticky",
          bottom: {
            xs: "calc(80px + var(--scripture-h, 0px) + env(safe-area-inset-bottom))",
            md: "calc(24px + var(--scripture-h, 0px))",
          },
          zIndex: 3,
          py: 1.5,
          bgcolor: TOKENS.ground,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button
          variant="contained"
          onClick={onSave}
          disabled={invalid || save.isPending}
          sx={{ background: invalid ? undefined : GRADIENT }}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}
