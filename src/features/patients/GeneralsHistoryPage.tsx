// src/features/patients/GeneralsHistoryPage.tsx
import { Box, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { usePatient } from "./usePatients";
import GeneralsHistoryTable from "../consultations/GeneralsHistoryTable";
import { usePatientGenerals } from "../consultations/useCaseRecord";
import QueryStates from "../../components/QueryStates";
import AvatarTile from "../../components/AvatarTile";
import { useSetPageTitle } from "../../components/PageChrome";
import { TOKENS } from "../../theme/theme";
import { useClinicFeatures } from "../../lib/useClinicFeatures";

/** Every recorded general compared visit by visit, newest first. */
export default function GeneralsHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: patient } = usePatient(id);
  const { status, data } = usePatientGenerals(id);
  const features = useClinicFeatures();
  const title = `${features.generalsTitle} history`;
  useSetPageTitle(title);
  const list = data ?? [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, mb: 2.5 }}>
        {patient && <AvatarTile name={patient.name} size={48} solid />}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1" sx={{ fontSize: { xs: 22, md: 26 } }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
            {patient ? `${patient.name} · #${patient.serialNo} · ` : ""}
            {list.length} visit{list.length === 1 ? "" : "s"} recorded
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
        Newest visit first.{" "}
        <Box
          component="span"
          sx={{
            px: 0.75,
            borderRadius: "4px",
            bgcolor: TOKENS.blue50,
            color: "text.primary",
            fontWeight: 600,
          }}
        >
          Highlighted
        </Box>{" "}
        values were changed at that visit; grey ones carried over.
      </Typography>
      <QueryStates
        status={status}
        isEmpty={list.length === 0}
        emptyMessage={`No ${features.generalsTitle.toLowerCase()} recorded yet`}
      >
        <GeneralsHistoryTable list={list} features={features} />
      </QueryStates>
    </Box>
  );
}
