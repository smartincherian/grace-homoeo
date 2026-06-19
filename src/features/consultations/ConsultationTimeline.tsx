// src/features/consultations/ConsultationTimeline.tsx
import { Stack } from "@mui/material";
import ListCard from "../../components/ListCard";
import { accentFor } from "../../theme/theme";
import { formatDate } from "../../lib/dates";
import type { Consultation } from "./consultationSchema";

interface Props {
  consultations: Consultation[];
  onSelect: (id: string) => void;
}

export default function ConsultationTimeline({
  consultations,
  onSelect,
}: Props) {
  return (
    <Stack>
      {consultations.map((c, i) => (
        <ListCard
          key={c.id}
          edgeColor={accentFor(i)}
          onClick={() => onSelect(c.id)}
          primary={`${formatDate(c.date)} — ${c.complaint || "Consultation"}`}
          secondary={
            <>
              {c.remedy ? `Remedy: ${c.remedy} · ` : ""}
              {`₹${c.amount} · ${c.paymentMode}`}
            </>
          }
        />
      ))}
    </Stack>
  );
}
