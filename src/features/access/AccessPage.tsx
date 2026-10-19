import { useState } from "react";
import { Box, Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import {
  useAddAllowedEmail,
  useAllowedEmails,
  useRemoveAllowedEmail,
} from "./useAllowedEmails";
import { isSuperadmin, normalizeEmail, SUPERADMIN_EMAIL } from "../../lib/access";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import ConfirmDialog from "../../components/ConfirmDialog";
import AvatarTile from "../../components/AvatarTile";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageColumn, PageHeader } from "../../components/PageLayout";
import { useToast } from "../../components/useToast";
import { CARD_SX, TOKENS } from "../../theme/theme";

const emailSchema = z.string().trim().email();

export default function AccessPage() {
  useSetPageTitle("Manage access");
  const { user, loading } = useAuth();
  const { status, data } = useAllowedEmails();
  const add = useAddAllowedEmail();
  const remove = useRemoveAllowedEmail();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [toRemove, setToRemove] = useState<string | null>(null);

  // useAuth starts with no user, so wait for it before deciding to redirect.
  if (loading) return null;
  if (!isSuperadmin(user?.email)) return <Navigate to="/patients" replace />;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) {
      setError("Enter a valid email address");
      return;
    }
    const value = normalizeEmail(email);
    if (value === SUPERADMIN_EMAIL || data?.some((a) => a.email === value)) {
      setError("This email already has access");
      return;
    }
    add.mutate(
      { email: value, clinicId: "", addedBy: user?.email ?? "" },
      {
        onSuccess: () => {
          setEmail("");
          showToast(`${value} can now sign in`, "success");
        },
        onError: () => showToast("Could not add email. Please try again.", "error"),
      },
    );
  };

  const confirmRemove = () => {
    if (!toRemove) return;
    const value = toRemove;
    setToRemove(null);
    remove.mutate(value, {
      onSuccess: () => showToast(`${value} removed`, "success"),
      onError: () => showToast("Could not remove email. Please try again.", "error"),
    });
  };

  return (
    <PageColumn>
      <PageHeader
        title="Manage access"
        subtitle="Only these accounts can sign in, with Google or email and password."
      />
      <Box
        component="form"
        onSubmit={submit}
        noValidate
        sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 3 }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            label="Email to allow"
            type="email"
            size="small"
            fullWidth
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            error={!!error}
            helperText={error || " "}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={add.isPending}
            sx={{ height: 40, flex: "none" }}
          >
            Allow
          </Button>
        </Stack>
      </Box>

      <ListCard
        avatar={<AvatarTile name={SUPERADMIN_EMAIL} solid />}
        primary={SUPERADMIN_EMAIL}
        secondary="Superadmin"
      />
      <QueryStates
        status={status}
        isEmpty={(data ?? []).length === 0}
        emptyMessage="No other accounts allowed yet"
      >
        {(data ?? []).map((a) => (
          <ListCard
            key={a.email}
            avatar={<AvatarTile name={a.email} seed={a.email.length} />}
            primary={a.email}
            secondary={
              a.addedAt
                ? `Added ${new Date(a.addedAt).toLocaleDateString()}`
                : undefined
            }
            trailing={
              <IconButton
                aria-label={`Remove ${a.email}`}
                size="small"
                disabled={remove.isPending}
                onClick={() => setToRemove(a.email)}
                sx={{ color: TOKENS.muted }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            }
          />
        ))}
      </QueryStates>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>
        Removing someone signs them out the next time they open the app.
      </Typography>

      <ConfirmDialog
        open={!!toRemove}
        title="Remove access?"
        message={`${toRemove ?? ""} will no longer be able to sign in.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </PageColumn>
  );
}
