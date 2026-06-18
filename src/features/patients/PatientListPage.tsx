// src/features/patients/PatientListPage.tsx
import { useMemo, useState } from "react";
import {
  Box, Fab, List, ListItemButton, ListItemText, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link, useNavigate } from "react-router-dom";
import { usePatients } from "./usePatients";
import QueryStates from "../../components/QueryStates";
import { calcAge, formatDate } from "../../lib/dates";

export default function PatientListPage() {
  const { status, data } = usePatients();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((p) => p.nameLower.includes(q) || p.phone.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Patients</Typography>
      <TextField
        label="Search by name or phone"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No patients yet">
        <List>
          {filtered.map((p) => (
            <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} divider>
              <ListItemText
                primary={<>{p.name}<Typography component="span" color="text.secondary"> · #{p.serialNo}</Typography></>}
                secondary={
                  `${calcAge(p.dob)} yrs` +
                  (p.place ? ` · ${p.place}` : "") +
                  (p.lastVisitAt ? ` · Last visit ${formatDate(p.lastVisitAt)}` : "")
                }
              />
            </ListItemButton>
          ))}
        </List>
      </QueryStates>
      <Fab color="primary" aria-label="Add patient" component={Link} to="/patients/new"
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
