import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/useToast";
import {
  aiErrorMessage,
  useAiStatus,
  useRemoveAiKey,
  useSaveAiKey,
} from "../../lib/aiSummary";
import { formatDate } from "../../lib/dates";
import { TOKENS } from "../../theme/theme";

const NOTICE =
  "Patient case notes (not name or phone) are sent to Google Gemini when a summary is generated. Use a key from a Google Cloud project with billing enabled — Google may use free-tier requests to improve its products. Avoid writing patient names or other identifying details in notes.";

// The typed key lives only in this component's state, so it is dropped
// when the form unmounts (saved, cancelled, or the section goes away).
function KeyForm({
  clinicId,
  onDone,
  onCancel,
}: {
  clinicId: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { showToast } = useToast();
  const save = useSaveAiKey(clinicId);
  const [key, setKey] = useState("");
  const trimmed = key.trim();

  const onSave = () => {
    save.mutate(trimmed, {
      onSuccess: () => {
        setKey("");
        showToast("Gemini key saved", "success");
        onDone();
      },
      onError: (e) => showToast(aiErrorMessage(e), "error"),
    });
  };

  return (
    <Stack spacing={1.5}>
      <TextField
        label="Gemini API key"
        type="password"
        size="small"
        fullWidth
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off"
        inputProps={{
          spellCheck: false,
          autoCapitalize: "off",
          "data-lpignore": "true",
        }}
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={!trimmed || save.isPending}
        >
          Save key
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </Stack>
    </Stack>
  );
}

export default function AiSummarySection({ clinicId }: { clinicId: string }) {
  const { showToast } = useToast();
  const status = useAiStatus(clinicId);
  const remove = useRemoveAiKey(clinicId);
  const [replacing, setReplacing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const onRemove = () => {
    setConfirming(false);
    remove.mutate(undefined, {
      onSuccess: () => {
        setReplacing(false);
        showToast("Gemini key removed", "success");
      },
      onError: (e) => showToast(aiErrorMessage(e), "error"),
    });
  };

  const s = status.data;
  return (
    <Box>
      <Typography sx={{ fontSize: 13, color: TOKENS.muted, mb: 1.5 }}>
        {NOTICE}{" "}
        <Link
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get a key
        </Link>
      </Typography>
      {!s ? (
        status.isError ? (
          <Typography>Couldn&apos;t load the AI key status.</Typography>
        ) : (
          <CircularProgress size={22} aria-label="Loading" />
        )
      ) : s.configured && !replacing ? (
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography>
            Key saved, ends in …{s.last4}
            {s.updatedAt ? ` (updated ${formatDate(s.updatedAt)})` : ""}
          </Typography>
          <Button variant="outlined" onClick={() => setReplacing(true)}>
            Replace
          </Button>
          <Button
            color="error"
            onClick={() => setConfirming(true)}
            disabled={remove.isPending}
          >
            Remove
          </Button>
        </Stack>
      ) : (
        <KeyForm
          clinicId={clinicId}
          onDone={() => setReplacing(false)}
          onCancel={s.configured ? () => setReplacing(false) : undefined}
        />
      )}
      <ConfirmDialog
        open={confirming}
        title="Remove Gemini key?"
        message="AI patient summaries will stop working until a new key is added."
        confirmLabel="Remove"
        onConfirm={onRemove}
        onClose={() => setConfirming(false)}
      />
    </Box>
  );
}
