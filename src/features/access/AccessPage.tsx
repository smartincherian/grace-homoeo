import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useAllowedEmails, useRemoveUnassigned } from "./useAllowedEmails";
import type { AllowedEmail } from "./accessRepo";
import { useClinics, useCreateClinic } from "./useClinics";
import { useAddUser, useRemoveUser, useSetOwner } from "../../lib/useSeats";
import { EMAIL_RE, SeatError, type Seat, type SeatId } from "../../lib/seats";
import type { Clinic } from "../../lib/clinicQueries";
import { isValidSlug, slugify } from "../../lib/clinic";
import { isSuperadmin, normalizeEmail } from "../../lib/access";
import QueryStates from "../../components/QueryStates";
import ConfirmDialog from "../../components/ConfirmDialog";
import AvatarTile from "../../components/AvatarTile";
import { useSetPageTitle } from "../../components/PageChrome";
import { PageColumn, PageHeader } from "../../components/PageLayout";
import { useToast } from "../../components/useToast";
import { CARD_SX, TOKENS } from "../../theme/theme";

const isEmail = (v: string) => EMAIL_RE.test(normalizeEmail(v));

/** Why `value` can't be given a seat in `targetClinicId`, or "" if it is free to add. */
function assignedMessage(
  value: string,
  targetClinicId: string | null,
  allowed: AllowedEmail[],
  clinics: Clinic[],
): string {
  const existing = allowed.find((a) => a.email === value);
  if (!existing) return "";
  if (targetClinicId !== null && existing.clinicId === targetClinicId) {
    return "This email already has access";
  }
  const name = clinics.find((c) => c.id === existing.clinicId)?.name;
  return name
    ? `Already assigned to ${name}. Remove it there first.`
    : "Already in the allow list without a clinic. Remove it under Unassigned first.";
}

export default function AccessPage() {
  useSetPageTitle("Admin");
  const { user, loading } = useAuth();
  const allowed = useAllowedEmails();
  const clinics = useClinics();
  const createClinic = useCreateClinic();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerError, setOwnerError] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  // useAuth starts with no user, so wait for it before deciding to redirect.
  if (loading) return null;
  if (!isSuperadmin(user?.email)) return <Navigate to="/" replace />;

  const ownerValid = isEmail(ownerEmail);
  const slugInvalid = slug !== "" && !isValidSlug(slug);

  const submitClinic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSlug(slug) || !ownerValid) return;
    const taken = assignedMessage(
      normalizeEmail(ownerEmail),
      null,
      allowed.data ?? [],
      clinics.data ?? [],
    );
    if (taken) {
      setOwnerError(taken);
      return;
    }
    const name = clinicName.trim();
    createClinic.mutate(
      {
        id: slug,
        name,
        ownerEmail: normalizeEmail(ownerEmail),
        addedBy: user?.email ?? "",
      },
      {
        onSuccess: () => {
          setClinicName("");
          setSlug("");
          setOwnerEmail("");
          setSlugEdited(false);
          showToast(`${name} created`, "success");
        },
        onError: (err) =>
          showToast(
            err.message === "Clinic already exists"
              ? "Clinic already exists"
              : err instanceof SeatError
                ? SEAT_MESSAGES[err.code]
                : "Could not create clinic. Please try again.",
            "error",
          ),
      },
    );
  };

  return (
    <PageColumn>
      <PageHeader
        title="Admin"
        subtitle="Create clinics and manage who can sign in to each, up to three users per clinic."
      />
      <Typography variant="h6" sx={{ mb: 1 }}>
        Clinics
      </Typography>
      <Box
        component="form"
        onSubmit={submitClinic}
        noValidate
        sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 2 }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            label="Clinic name"
            size="small"
            fullWidth
            value={clinicName}
            onChange={(e) => {
              setClinicName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
            helperText=" "
          />
          <TextField
            label="Slug"
            size="small"
            fullWidth
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            error={slugInvalid}
            helperText={
              slugInvalid
                ? "Lowercase letters, numbers and hyphens (3–40)"
                : " "
            }
          />
          <TextField
            label="Owner email"
            type="email"
            size="small"
            fullWidth
            value={ownerEmail}
            onChange={(e) => {
              setOwnerEmail(e.target.value);
              setOwnerError("");
            }}
            error={!!ownerError}
            helperText={ownerError || " "}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={
              !isValidSlug(slug) ||
              !clinicName.trim() ||
              !ownerValid ||
              createClinic.isPending
            }
            sx={{ height: 40, flex: "none" }}
          >
            Create clinic
          </Button>
        </Stack>
      </Box>
      <QueryStates
        status={clinics.status}
        isEmpty={(clinics.data ?? []).length === 0}
        emptyMessage="No clinics yet"
      >
        {(clinics.data ?? []).map((c) => (
          <ClinicSection
            key={c.id}
            clinic={c}
            clinics={clinics.data ?? []}
            allowed={allowed.data ?? []}
            adminEmail={user?.email ?? ""}
            onOpen={() => navigate(`/${c.id}/patients`)}
          />
        ))}
      </QueryStates>
      {clinics.status === "success" && (
        <UnassignedSection
          entries={(allowed.data ?? []).filter(
            (a) => !(clinics.data ?? []).some((c) => c.id === a.clinicId),
          )}
        />
      )}
      <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 2 }}>
        Removing someone signs them out the next time they open the app.
      </Typography>
    </PageColumn>
  );
}

const SEATLESS_TIP = "Run the seat backfill first";

const SEAT_MESSAGES: Record<SeatError["code"], string> = {
  full: "This clinic already has three users.",
  duplicate: "This email already has access",
  superadmin: "This email already has access",
  invalid: "Enter a valid email address",
  unavailable: "Could not add user. It may be assigned to another clinic.",
  owner: "Make someone else owner first",
};

interface SectionProps {
  clinic: Clinic;
  clinics: Clinic[];
  allowed: AllowedEmail[];
  adminEmail: string;
  onOpen: () => void;
}

function ClinicSection({
  clinic,
  clinics,
  allowed,
  adminEmail,
  onOpen,
}: SectionProps) {
  const { showToast } = useToast();
  const add = useAddUser(clinic.id);
  const remove = useRemoveUser(clinic.id);
  const makeOwner = useSetOwner();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [toRemove, setToRemove] = useState<AllowedEmail | null>(null);

  const users = allowed.filter((a) => a.clinicId === clinic.id);
  const seats: Seat[] = users
    .filter((u) => u.seat)
    .map((u) => ({ seat: u.seat as SeatId, email: u.email }));
  const owner = clinic.ownerEmail ? normalizeEmail(clinic.ownerEmail) : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    const value = normalizeEmail(email);
    const taken = assignedMessage(value, clinic.id, allowed, clinics);
    if (taken) {
      setError(taken);
      return;
    }
    add.mutate(
      { email: value, addedBy: adminEmail, seats },
      {
        onSuccess: () => {
          setEmail("");
          showToast(`${value} can now sign in`, "success");
        },
        onError: (err) =>
          err instanceof SeatError
            ? setError(SEAT_MESSAGES[err.code])
            : showToast("Could not add user. Please try again.", "error"),
      },
    );
  };

  const confirmRemove = () => {
    if (!toRemove) return;
    const target = toRemove;
    setToRemove(null);
    remove.mutate(
      {
        seat: { seat: target.seat as SeatId, email: target.email },
        ownerEmail: clinic.ownerEmail,
      },
      {
        onSuccess: () => showToast(`${target.email} removed`, "success"),
        onError: () =>
          showToast("Could not remove user. Please try again.", "error"),
      },
    );
  };

  return (
    <Box sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
        <AvatarTile name={clinic.name} seed={clinic.name.length} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>{clinic.name}</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            {clinic.id}
          </Typography>
          {!owner && (
            <Typography sx={{ fontSize: 13, color: "warning.main" }}>
              No owner set
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          onClick={onOpen}
          aria-label={`Open ${clinic.name}`}
        >
          Open
        </Button>
      </Stack>
      {users.map((u) => {
        const isOwner = u.email === owner;
        return (
          <Stack
            key={u.email}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ py: 0.5 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14 }}>
                {u.email}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {u.seat ? `Seat ${u.seat}` : "No seat (legacy)"}
              </Typography>
            </Box>
            {isOwner ? (
              <Chip label="Owner" size="small" color="primary" />
            ) : (
              <Tooltip title={u.seat ? "" : SEATLESS_TIP}>
                <span>
                  <Button
                    size="small"
                    disabled={!u.seat}
                    aria-label={`Make ${u.email} owner`}
                    onClick={() =>
                      makeOwner.mutate(
                        { clinicId: clinic.id, email: u.email },
                        {
                          onSuccess: () =>
                            showToast(`${u.email} is now the owner`, "success"),
                          onError: () =>
                            showToast(
                              "Could not change owner. Please try again.",
                              "error",
                            ),
                        },
                      )
                    }
                  >
                    Make owner
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip
              title={
                isOwner
                  ? "Make someone else owner first"
                  : u.seat
                    ? ""
                    : SEATLESS_TIP
              }
            >
              <span>
                <IconButton
                  aria-label={`Remove ${u.email}`}
                  size="small"
                  disabled={isOwner || !u.seat || remove.isPending}
                  onClick={() => setToRemove(u)}
                  sx={{ color: TOKENS.muted }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      })}
      <Box component="form" onSubmit={submit} noValidate sx={{ mt: 1.5 }}>
        <Stack direction="row" spacing={1.5}>
          <TextField
            label={`Add user to ${clinic.name}`}
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
            aria-label={`Add to ${clinic.name}`}
            disabled={add.isPending}
            sx={{ height: 40, flex: "none" }}
          >
            Add
          </Button>
        </Stack>
      </Box>
      <ConfirmDialog
        open={!!toRemove}
        title="Remove access?"
        message={`${toRemove?.email ?? ""} will no longer be able to sign in.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}

function UnassignedSection({ entries }: { entries: AllowedEmail[] }) {
  const { showToast } = useToast();
  const remove = useRemoveUnassigned();
  const [toRemove, setToRemove] = useState<string | null>(null);
  if (entries.length === 0) return null;

  const confirmRemove = () => {
    if (!toRemove) return;
    const email = toRemove;
    setToRemove(null);
    remove.mutate(email, {
      onSuccess: () => showToast(`${email} removed`, "success"),
      onError: () =>
        showToast("Could not remove email. Please try again.", "error"),
    });
  };

  return (
    <Box sx={{ ...CARD_SX, p: { xs: 2, md: 2.5 }, mb: 2, mt: 3 }}>
      <Typography variant="h6">Unassigned</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1 }}>
        These emails are on the allow list but belong to no clinic.
      </Typography>
      {entries.map((a) => (
        <Stack
          key={a.email}
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ py: 0.5 }}
        >
          <Typography noWrap sx={{ flex: 1, fontSize: 14 }}>
            {a.email}
          </Typography>
          <IconButton
            aria-label={`Remove ${a.email}`}
            size="small"
            disabled={remove.isPending}
            onClick={() => setToRemove(a.email)}
            sx={{ color: TOKENS.muted }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <ConfirmDialog
        open={!!toRemove}
        title="Remove access?"
        message={`${toRemove ?? ""} will no longer be able to sign in.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
    </Box>
  );
}
