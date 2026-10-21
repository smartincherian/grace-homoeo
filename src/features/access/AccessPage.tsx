import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useAllowedEmails, useRemoveUnassigned } from "./useAllowedEmails";
import type { AllowedEmail } from "./accessRepo";
import {
  useClinics,
  useCreateClinic,
  useDeleteClinic,
  useSetClinicActive,
  useSetClinicAuthorized,
  useSetClinicType,
  useSetUserActive,
} from "./useClinics";
import { useAddUser, useRemoveUser, useSetOwner } from "../../lib/useSeats";
import { EMAIL_RE, SeatError, type Seat, type SeatId } from "../../lib/seats";
import type { Clinic } from "../../lib/clinicQueries";
import {
  CLINIC_TYPES,
  clinicTypeLabel,
  type ClinicType,
} from "../../lib/clinicType";
import { formatDate } from "../../lib/dates";
import { clinicStatus, type ClinicStatus } from "../../lib/subscription";
import { isValidSlug, slugify } from "../../lib/clinic";
import { isSuperadmin, normalizeEmail } from "../../lib/access";
import QueryStates from "../../components/QueryStates";
import ConfirmDialog from "../../components/ConfirmDialog";
import RowMenu from "../../components/RowMenu";
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
  const [authorizedNew, setAuthorizedNew] = useState(false);
  const [typeNew, setTypeNew] = useState<ClinicType>("homoeo");

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
        authorized: authorizedNew,
        type: typeNew,
      },
      {
        onSuccess: () => {
          setClinicName("");
          setSlug("");
          setOwnerEmail("");
          setSlugEdited(false);
          setAuthorizedNew(false);
          setTypeNew("homoeo");
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
    <PageColumn maxWidth={1100}>
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
          <ClinicTypeSelect value={typeNew} onChange={setTypeNew} />
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
          <FormControlLabel
            sx={{ flex: "none", mr: 0, whiteSpace: "nowrap" }}
            control={
              <Checkbox
                checked={authorizedNew}
                onChange={(e) => setAuthorizedNew(e.target.checked)}
              />
            }
            label="Authorized (no trial)"
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
        <Box sx={{ ...CARD_SX, mb: 2, overflowX: "auto" }}>
          <Table size="small" aria-label="Clinics">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40, p: 0.5 }} />
                <TableCell>Clinic</TableCell>
                <TableCell sx={HIDE_XS}>Owner</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(clinics.data ?? []).map((c) => (
                <ClinicRow
                  key={c.id}
                  clinic={c}
                  clinics={clinics.data ?? []}
                  allowed={allowed.data ?? []}
                  adminEmail={user?.email ?? ""}
                  onOpen={() => navigate(`/${c.id}/patients`)}
                />
              ))}
            </TableBody>
          </Table>
        </Box>
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

function statusChip(s: ClinicStatus) {
  switch (s.kind) {
    case "authorized":
      return { label: "Authorized", color: "success" as const };
    case "trial":
      return {
        label: `Trial · ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left`,
        color: s.daysLeft <= 5 ? ("warning" as const) : ("default" as const),
      };
    case "expired":
      return { label: "Trial ended", color: "error" as const };
    default:
      return { label: "Legacy", color: "default" as const };
  }
}

/** `s` is the status the clinic falls back to once authorization is removed. */
function removeAuthorizationMessage(s: ClinicStatus): string {
  if (s.kind === "legacy")
    return "This clinic has no trial, so it becomes read-only immediately.";
  if (s.kind === "trial")
    return `It goes back to its free trial (${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left).`;
  return "It becomes read-only.";
}

const SEATLESS_TIP = "Run the seat backfill first";
const HIDE_XS = { display: { xs: "none", sm: "table-cell" } };

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

function ClinicRow({
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
  const setClinicActive = useSetClinicActive();
  const setUserActive = useSetUserActive();
  const setAuthorized = useSetClinicAuthorized();
  const [confirmAuth, setConfirmAuth] = useState(false);
  const [now] = useState(() => Date.now());
  const status = clinicStatus(clinic, now);
  const chip = statusChip(status);
  const [expanded, setExpanded] = useState(false);
  const [confirmInactive, setConfirmInactive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const active = clinic.active !== false;
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

  const toggleClinic = (next: boolean) =>
    setClinicActive.mutate(
      { id: clinic.id, active: next },
      {
        onSuccess: () =>
          showToast(
            `${clinic.name} is now ${next ? "active" : "inactive"}`,
            "success",
          ),
        onError: () =>
          showToast("Could not change the clinic. Please try again.", "error"),
      },
    );

  const changeAuthorized = (next: boolean) =>
    setAuthorized.mutate(
      { clinic, authorized: next },
      {
        onSuccess: () =>
          showToast(
            `${clinic.name} is ${next ? "authorized" : "no longer authorized"}`,
            "success",
          ),
        onError: () =>
          showToast("Could not change the clinic. Please try again.", "error"),
      },
    );

  const toggleUser = (u: AllowedEmail) =>
    setUserActive.mutate(
      { email: u.email, active: !u.active },
      {
        onSuccess: () =>
          showToast(
            `${u.email} is now ${u.active ? "inactive" : "active"}`,
            "success",
          ),
        onError: () =>
          showToast("Could not change the user. Please try again.", "error"),
      },
    );

  return (
    <>
      <TableRow sx={{ "& > td": { borderBottom: expanded ? 0 : undefined } }}>
        <TableCell sx={{ p: 0.5 }}>
          <IconButton
            size="small"
            aria-label={`${expanded ? "Hide" : "Show"} users of ${clinic.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <KeyboardArrowDownIcon fontSize="small" />
            ) : (
              <KeyboardArrowRightIcon fontSize="small" />
            )}
          </IconButton>
        </TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AvatarTile name={clinic.name} seed={clinic.name.length} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                {clinic.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  color: "text.secondary",
                  whiteSpace: "nowrap",
                }}
              >
                {`${clinic.id} · ${formatDate(clinic.createdAt)}`}
              </Typography>
            </Box>
          </Stack>
        </TableCell>
        <TableCell sx={HIDE_XS}>
          {owner ? (
            <Typography noWrap sx={{ fontSize: 14, maxWidth: 220 }}>
              {owner}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 13, color: "warning.main" }}>
              No owner set
            </Typography>
          )}
        </TableCell>
        <TableCell>{`${users.length}/3`}</TableCell>
        <TableCell>
          <Chip
            size="small"
            label={active ? "Active" : "Inactive"}
            color={active ? "success" : "warning"}
            variant={active ? "outlined" : "filled"}
          />
          <Chip
            size="small"
            label={chip.label}
            color={chip.color}
            sx={{ ml: 0.5 }}
          />
          <Chip
            size="small"
            variant="outlined"
            label={clinicTypeLabel(clinic.type ?? "homoeo")}
            sx={{ ml: 0.5 }}
          />
          {clinic.selfSignup && (
            <Chip size="small" label="Self signup" sx={{ ml: 0.5 }} />
          )}
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
          <Button
            size="small"
            onClick={onOpen}
            aria-label={`Open ${clinic.name}`}
          >
            Open
          </Button>
          <RowMenu
            label={clinic.name}
            actions={[
              {
                label: active ? "Make inactive" : "Make active",
                onClick: () =>
                  active ? setConfirmInactive(true) : toggleClinic(true),
              },
              {
                label:
                  status.kind === "authorized"
                    ? "Remove authorization"
                    : "Authorize",
                onClick: () => setConfirmAuth(true),
              },
              { label: "Change type", onClick: () => setChangingType(true) },
              { label: "Delete clinic", onClick: () => setDeleting(true) },
            ]}
          />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ pt: 0, pb: 2, px: { xs: 1.5, sm: 7 } }}>
            {!owner && (
              <Typography sx={{ fontSize: 13, color: "warning.main", py: 0.5 }}>
                No owner set
              </Typography>
            )}
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
                  {!u.active && (
                    <Chip label="Inactive" size="small" color="warning" />
                  )}
                  <Button
                    size="small"
                    aria-label={`Make ${u.email} ${u.active ? "inactive" : "active"}`}
                    disabled={setUserActive.isPending}
                    onClick={() => toggleUser(u)}
                  >
                    {u.active ? "Make inactive" : "Make active"}
                  </Button>
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
                                  showToast(
                                    `${u.email} is now the owner`,
                                    "success",
                                  ),
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
          </TableCell>
        </TableRow>
      )}
      <ConfirmDialog
        open={!!toRemove}
        title="Remove access?"
        message={`${toRemove?.email ?? ""} will no longer be able to sign in.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onClose={() => setToRemove(null)}
      />
      <ConfirmDialog
        open={confirmInactive}
        title={`Make ${clinic.name} inactive?`}
        message={`Everyone in ${clinic.name}, the owner too, will be blocked until you make it active again. No data is deleted.`}
        confirmLabel="Make inactive"
        onConfirm={() => {
          setConfirmInactive(false);
          toggleClinic(false);
        }}
        onClose={() => setConfirmInactive(false)}
      />
      <ConfirmDialog
        open={confirmAuth}
        title={
          status.kind === "authorized"
            ? `Remove authorization from ${clinic.name}?`
            : `Authorize ${clinic.name}?`
        }
        message={
          status.kind === "authorized"
            ? removeAuthorizationMessage(
                clinicStatus({ trialEndsAt: clinic.trialEndsAt }, now),
              )
            : `${clinic.name} will never expire.`
        }
        confirmLabel={
          status.kind === "authorized" ? "Remove authorization" : "Authorize"
        }
        onConfirm={() => {
          setConfirmAuth(false);
          changeAuthorized(status.kind !== "authorized");
        }}
        onClose={() => setConfirmAuth(false)}
      />
      {changingType && (
        <ChangeTypeDialog
          clinic={clinic}
          onClose={() => setChangingType(false)}
        />
      )}
      {deleting && (
        <DeleteClinicDialog
          clinic={clinic}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  );
}

function ClinicTypeSelect({
  value,
  onChange,
}: {
  value: ClinicType;
  onChange: (t: ClinicType) => void;
}) {
  return (
    <TextField
      select
      label="Clinic type"
      size="small"
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value as ClinicType)}
      helperText=" "
    >
      {CLINIC_TYPES.map((t) => (
        <MenuItem key={t.value} value={t.value}>
          {t.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Hiding parts is display only, so a type change never loses data. */
function ChangeTypeDialog({
  clinic,
  onClose,
}: {
  clinic: Clinic;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<ClinicType>(clinic.type ?? "homoeo");
  const save = useSetClinicType();
  const confirm = () =>
    save.mutate(
      { id: clinic.id, type },
      {
        onSuccess: () => {
          showToast(
            `${clinic.name} is now ${clinicTypeLabel(type)}`,
            "success",
          );
          onClose();
        },
        onError: () =>
          showToast("Could not change the clinic. Please try again.", "error"),
      },
    );

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{`Change ${clinic.name}'s type`}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          The type decides which case-taking parts show (such as LSMC for
          homoeopathy). No data is deleted.
        </Typography>
        <ClinicTypeSelect value={type} onChange={setType} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending} onClick={confirm}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Deleting wipes a clinic's data, so the slug must be typed to confirm. */
function DeleteClinicDialog({
  clinic,
  onClose,
}: {
  clinic: Clinic;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [typed, setTyped] = useState("");
  const [step, setStep] = useState("");
  const del = useDeleteClinic(setStep);
  const confirm = () =>
    del.mutate(clinic.id, {
      onSuccess: () => {
        showToast(`${clinic.name} deleted`, "success");
        onClose();
      },
      onError: () =>
        showToast(
          "Could not finish deleting. Try again to remove what is left.",
          "error",
        ),
    });

  return (
    <Dialog
      open
      onClose={del.isPending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{`Delete ${clinic.name}?`}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          {`This permanently deletes ${clinic.name} and all its data (patients, consultations, inventory, funds, staff, bookings and settings) and removes its users' access. This can't be undone.`}
        </Typography>
        <TextField
          label={`Type ${clinic.id} to confirm`}
          size="small"
          fullWidth
          autoFocus
          value={typed}
          disabled={del.isPending}
          onChange={(e) => setTyped(e.target.value)}
        />
        {del.isPending && (
          <Typography sx={{ mt: 1.5, fontSize: 13, color: "text.secondary" }}>
            {`Deleting… ${step}`}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={del.isPending}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={typed.trim() !== clinic.id || del.isPending}
          onClick={confirm}
        >
          Delete clinic
        </Button>
      </DialogActions>
    </Dialog>
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
