import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonRemoveIcon from "@mui/icons-material/PersonRemoveOutlined";
import { useParams } from "react-router-dom";
import QueryStates from "../../components/QueryStates";
import ListCard from "../../components/ListCard";
import AvatarTile from "../../components/AvatarTile";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageHeader } from "../../components/PageLayout";
import { useToast } from "../../components/useToast";
import { useAuth } from "../auth/useAuth";
import { useClinic } from "../../lib/clinicQueries";
import { useAddUser, useRemoveUser, useSeats } from "../../lib/useSeats";
import { SEAT_IDS, SeatError, type Seat } from "../../lib/seats";
import { normalizeEmail } from "../../lib/access";
import { CARD_SX, PILL_SX, TOKENS } from "../../theme/theme";

const MAX_TEXT = "This clinic has the maximum of 3 users.";

function errorMessage(e: unknown): string {
  if (e instanceof SeatError) {
    switch (e.code) {
      case "duplicate":
        return "Already a user of this clinic.";
      case "superadmin":
      case "invalid":
        return "Enter a valid email address.";
      case "unavailable":
        return "This email can't be added.";
      case "full":
        return MAX_TEXT;
    }
  }
  return "Could not complete that. Please try again.";
}

export default function PeoplePage() {
  useSetPageTitle("People");
  const { clinicSlug = "" } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { status, data } = useSeats(clinicSlug);
  const ownerEmail = useClinic(clinicSlug).data?.ownerEmail;
  const addUser = useAddUser(clinicSlug);
  const removeUser = useRemoveUser(clinicSlug);
  const [email, setEmail] = useState("");
  const [toRemove, setToRemove] = useState<Seat | null>(null);

  const seats = data ?? [];
  const full = seats.length >= SEAT_IDS.length;
  const isOwner = (s: Seat) =>
    !!ownerEmail && normalizeEmail(ownerEmail) === s.email;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (full || !email.trim()) return;
    addUser.mutate(
      { email, addedBy: normalizeEmail(user?.email ?? ""), seats },
      {
        onSuccess: () => {
          setEmail("");
          showToast("User added", "success");
        },
        onError: (err) => showToast(errorMessage(err), "error"),
      },
    );
  };

  const confirmRemove = () => {
    if (!toRemove) return;
    const seat = toRemove;
    setToRemove(null);
    removeUser.mutate(
      { seat, ownerEmail },
      {
        onSuccess: () => showToast("User removed", "success"),
        onError: (err) => showToast(errorMessage(err), "error"),
      },
    );
  };

  return (
    <Box>
      <PageHeader
        title="People"
        subtitle={
          data ? `${seats.length} of ${SEAT_IDS.length} users` : undefined
        }
      />
      <Box
        component="section"
        sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 3 }}
      >
        <QueryStates
          status={status}
          isEmpty={seats.length === 0}
          emptyMessage="No users yet"
        >
          {seats.map((s) => {
            const owner = isOwner(s);
            return (
              <ListCard
                key={s.seat}
                avatar={<AvatarTile name={s.email} seed={s.email.length} />}
                primary={
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    component="span"
                  >
                    <span>{s.email}</span>
                    <Box
                      component="span"
                      sx={{
                        ...PILL_SX,
                        py: 0.25,
                        bgcolor: owner ? TOKENS.blue50 : TOKENS.ground,
                        color: owner ? TOKENS.blue700 : TOKENS.muted,
                      }}
                    >
                      {owner ? "Owner" : "Member"}
                    </Box>
                  </Stack>
                }
                trailing={
                  owner ? undefined : (
                    <IconButton
                      aria-label={`Remove ${s.email}`}
                      disabled={removeUser.isPending}
                      onClick={() => setToRemove(s)}
                    >
                      <PersonRemoveIcon />
                    </IconButton>
                  )
                }
              />
            );
          })}
        </QueryStates>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>
          Added users sign in with Google, or create a password on the login
          page and verify their email.
        </Typography>
      </Box>
      <Box
        component="form"
        onSubmit={submit}
        sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 } }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems="flex-start"
        >
          <TextField
            label="Email"
            type="email"
            size="small"
            fullWidth
            value={email}
            disabled={full}
            onChange={(e) => setEmail(e.target.value)}
            helperText={full ? MAX_TEXT : undefined}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={full || addUser.isPending}
            sx={{ height: 40, flex: "none" }}
          >
            Add user
          </Button>
        </Stack>
      </Box>
      <ConfirmDialog
        open={!!toRemove}
        title="Remove user?"
        message={
          toRemove
            ? `Remove ${toRemove.email}? They will lose access immediately.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
