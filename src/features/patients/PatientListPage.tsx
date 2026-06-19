// src/features/patients/PatientListPage.tsx
import { useMemo, useState } from "react";
import { Avatar, Box, Chip, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { usePatients } from "./usePatients";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import { useSetPageTitle } from "../../components/PageChrome";
import { calcAge, formatDate } from "../../lib/dates";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export default function PatientListPage() {
  useSetPageTitle("Patients");
  const { status, data } = usePatients();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (p) => p.nameLower.includes(q) || p.phone.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <TextField
        label="Search by name or phone"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates
        status={status}
        isEmpty={filtered.length === 0}
        emptyMessage="No patients yet"
      >
        {filtered.map((p) => (
          <ListCard
            key={p.id}
            onClick={() => navigate(`/patients/${p.id}`)}
            avatar={
              <Avatar
                sx={{ bgcolor: "#E8F0FE", color: "#1F5FC0", fontWeight: 700 }}
              >
                {initials(p.name)}
              </Avatar>
            }
            primary={p.name}
            secondary={
              `${calcAge(p.dob)} yrs` +
              (p.place ? ` · ${p.place}` : "") +
              (p.lastVisitAt
                ? ` · Last visit ${formatDate(p.lastVisitAt)}`
                : "")
            }
            trailing={
              <Chip
                size="small"
                label={`#${p.serialNo}`}
                sx={{ bgcolor: "#EAF1FF", color: "#2E73D6", fontWeight: 600 }}
              />
            }
          />
        ))}
      </QueryStates>
      <AddButton label="Add patient" to="/patients/new" />
    </Box>
  );
}
