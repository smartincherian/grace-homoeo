// src/features/patients/PatientListPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  InputBase,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";
import { Link, useNavigate } from "react-router-dom";
import { usePatients } from "./usePatients";
import type { Patient } from "./patientSchema";
import PatientPreview from "./PatientPreview";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import AvatarTile from "../../components/AvatarTile";
import { PageHeader } from "../../components/PageLayout";
import { useSetPageTitle } from "../../components/PageChrome";
import { calcAge, daysAgoLabel } from "../../lib/dates";
import { CARD_SX, LINE, TOKENS } from "../../theme/theme";

type Filter = "all" | "today" | "week";

const sexLetter = (g: string) => g[0] ?? "";

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

// Patient · Age · Place · Last visit
const COLUMNS = "1.9fr 70px 1fr 1fr";

export default function PatientListPage() {
  useSetPageTitle("Patients");
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { status, data } = usePatients();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const list = data ?? [];
    const todayMs = dayjs().startOf("day").valueOf();
    const weekMs = dayjs().subtract(6, "day").startOf("day").valueOf();
    return {
      all: list.length,
      today: list.filter((p) => (p.lastVisitAt ?? 0) >= todayMs).length,
      week: list.filter((p) => (p.lastVisitAt ?? 0) >= weekMs).length,
      todayMs,
      weekMs,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    let list = data ?? [];
    if (filter === "today")
      list = list.filter((p) => (p.lastVisitAt ?? 0) >= counts.todayMs);
    if (filter === "week")
      list = list.filter((p) => (p.lastVisitAt ?? 0) >= counts.weekMs);
    if (!q) return list;
    return list.filter(
      (p) =>
        p.nameLower.includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.place.toLowerCase().includes(q) ||
        String(p.serialNo) === q,
    );
  }, [data, search, filter, counts]);

  const selected: Patient | undefined =
    filtered.find((p) => p.id === selectedId) ?? filtered[0];

  // "/" focuses search, "n" adds a patient; on desktop ↑/↓ move the
  // selection and Enter opens it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const nav =
        e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter";
      if (isTyping(e.target)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        if (!nav || e.target !== searchRef.current) return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        navigate("/patients/new");
      } else if (isDesktop && selected && nav) {
        e.preventDefault();
        if (e.key === "Enter") return navigate(`/patients/${selected.id}`);
        const i = filtered.findIndex((p) => p.id === selected.id);
        const next = filtered[i + (e.key === "ArrowDown" ? 1 : -1)];
        if (next) setSelectedId(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, isDesktop, navigate]);

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "today", label: "Today", count: counts.today },
    { key: "week", label: "This week", count: counts.week },
  ];

  const searchBox = (
    <Box
      sx={{
        width: { xs: "100%", md: 420 },
        height: 46,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2,
        bgcolor: TOKENS.white,
        border: LINE,
        borderRadius: "14px",
        boxShadow: "0 1px 2px rgba(20,26,46,.04)",
        "&:focus-within": {
          borderColor: TOKENS.blue,
          boxShadow: `0 0 0 4px ${TOKENS.blue100}`,
        },
      }}
    >
      <SearchIcon sx={{ fontSize: 20, color: TOKENS.muted }} />
      <InputBase
        inputRef={searchRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, phone, place or no."
        inputProps={{ "aria-label": "Search patients" }}
        sx={{ flex: 1, fontSize: 14 }}
      />
      {isDesktop && (
        <Box
          component="span"
          sx={{
            fontSize: 12,
            color: TOKENS.muted,
            bgcolor: TOKENS.ground,
            borderRadius: "6px",
            px: 1,
            py: 0.25,
          }}
        >
          /
        </Box>
      )}
    </Box>
  );

  const rows = isDesktop ? (
    <Box role="list" sx={{ pb: 1 }}>
      {filtered.map((p) => {
        const isSel = p.id === selected?.id;
        return (
          <ButtonBase
            key={p.id}
            role="listitem"
            aria-current={isSel ? "true" : undefined}
            onClick={() => setSelectedId(p.id)}
            onDoubleClick={() => navigate(`/patients/${p.id}`)}
            sx={{
              display: "grid",
              gridTemplateColumns: COLUMNS,
              gap: 1.75,
              alignItems: "center",
              width: "calc(100% - 16px)",
              mx: 1,
              my: 0.25,
              px: 1.75,
              py: 1.375,
              borderRadius: "14px",
              textAlign: "left",
              fontSize: 14,
              bgcolor: isSel ? TOKENS.blue50 : "transparent",
              outline: isSel ? `1.5px solid ${TOKENS.blue200}` : "none",
              "&:hover": { bgcolor: isSel ? TOKENS.blue50 : "action.hover" },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                minWidth: 0,
              }}
            >
              <AvatarTile name={p.name} seed={p.serialNo} />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 15 }}>
                  {p.name}
                </Typography>
                <Typography
                  noWrap
                  sx={{ fontSize: 12, color: "text.secondary" }}
                >
                  #{p.serialNo}
                  {p.phone ? ` · ${p.phone}` : ""}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
              {calcAge(p.dob)} {sexLetter(p.gender)}
            </Typography>
            <Typography noWrap sx={{ fontSize: 14, color: "text.secondary" }}>
              {p.place || "—"}
            </Typography>
            {p.lastVisitAt ? (
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                  {dayjs(p.lastVisitAt).format("D MMM YYYY")}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {daysAgoLabel(p.lastVisitAt)}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: 14, color: "text.disabled" }}>
                No visits
              </Typography>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  ) : (
    <Box role="list">
      {filtered.map((p, i) => (
        <ButtonBase
          key={p.id}
          role="listitem"
          onClick={() => navigate(`/patients/${p.id}`)}
          sx={{
            width: "100%",
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            textAlign: "left",
            px: 2,
            py: 1.5,
            borderTop: i ? LINE : "none",
          }}
        >
          <AvatarTile name={p.name} seed={p.serialNo} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 15 }}>
              {p.name}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
              {`#${p.serialNo} · ${calcAge(p.dob)} ${sexLetter(p.gender)}`}
              {p.place ? ` · ${p.place}` : ""}
            </Typography>
          </Box>
          <Typography
            sx={{ fontSize: 12, color: "text.secondary", flex: "none" }}
          >
            {p.lastVisitAt ? daysAgoLabel(p.lastVisitAt) : "—"}
          </Typography>
        </ButtonBase>
      ))}
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Patients"
        subtitle={`${counts.all} registered · sorted by last visit`}
        actions={
          <>
            {searchBox}
            {isDesktop && (
              <Button
                variant="contained"
                component={Link}
                to="/patients/new"
                startIcon={<AddIcon />}
                sx={{ height: 46, flex: "none" }}
              >
                Add patient
              </Button>
            )}
          </>
        }
      />

      <Box
        role="group"
        aria-label="Filter patients"
        sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <ButtonBase
              key={f.key}
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              sx={{
                px: 2,
                py: 1,
                borderRadius: "99px",
                fontSize: 13,
                fontWeight: 600,
                bgcolor: on ? TOKENS.ink : TOKENS.white,
                color: on ? TOKENS.white : TOKENS.muted,
                border: on ? `1px solid ${TOKENS.ink}` : LINE,
              }}
            >
              {f.label} · {f.count}
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 380px" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box sx={{ ...CARD_SX, overflow: "hidden", minWidth: 0 }}>
          {isDesktop && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: COLUMNS,
                gap: 1.75,
                px: 2.75,
                py: 1.75,
                fontSize: 12,
                fontWeight: 600,
                color: "text.secondary",
                borderBottom: LINE,
              }}
            >
              <span>Patient</span>
              <span>Age</span>
              <span>Place</span>
              <span>Last visit</span>
            </Box>
          )}
          <QueryStates
            status={status}
            isEmpty={filtered.length === 0}
            emptyMessage={
              search || filter !== "all"
                ? "No matching patients"
                : "No patients yet"
            }
          >
            {rows}
          </QueryStates>
        </Box>

        {isDesktop && selected && <PatientPreview patient={selected} />}
      </Box>

      {!isDesktop && <AddButton label="Add patient" to="/patients/new" />}
    </Box>
  );
}
