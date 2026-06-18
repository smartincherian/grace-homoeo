// src/features/consultations/ConsultationTimeline.tsx
import { List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { formatDate } from "../../lib/dates";
import type { Consultation } from "./consultationSchema";

interface Props {
  consultations: Consultation[];
  onSelect: (id: string) => void;
}

export default function ConsultationTimeline({ consultations, onSelect }: Props) {
  return (
    <List disablePadding>
      {consultations.map((c) => (
        <ListItemButton key={c.id} onClick={() => onSelect(c.id)} divider>
          <ListItemText
            primary={
              <Typography component="span" sx={{ fontWeight: 600 }}>
                {formatDate(c.date)} — {c.complaint || "Consultation"}
              </Typography>
            }
            secondary={
              <>
                {c.remedy && <span>Remedy: {c.remedy} · </span>}
                <span>₹{c.amount} · {c.paymentMode}</span>
              </>
            }
          />
        </ListItemButton>
      ))}
    </List>
  );
}
