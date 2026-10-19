// src/features/consultations/ConsultationFields.tsx
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type { Consultation } from "./consultationSchema";
import { isGeneralsBlank } from "./caseRecordSchema";
import { useConsultationGenerals, useConsultationLsmc } from "./useCaseRecord";
import GeneralsView from "./GeneralsView";
import LsmcTable from "./LsmcTable";

type FieldDef = { name: keyof Consultation; label: string };

const CLINICAL: FieldDef[] = [
  { name: "diagnosis", label: "Diagnosis" },
  { name: "testsRequired", label: "Tests required" },
  { name: "remedy", label: "Prescription" },
  { name: "differentialRemedy", label: "Differential remedy" },
  { name: "followupCriteria", label: "Followup criteria" },
];

const CASE_NOTES: FieldDef[] = [
  { name: "complaint", label: "Complaint" },
  { name: "remarks", label: "Remarks" },
  // Legacy per-visit text from before Generals became patient-level.
  { name: "generals", label: "Generals (notes)" },
  { name: "allergy", label: "Allergy" },
  { name: "history", label: "History" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ whiteSpace: "pre-wrap" }}>{value}</Typography>
    </Box>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {children}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
    </>
  );
}

/** Clinical card + case notes for one consultation; shared by the page and the history drawer. Blank fields are hidden. */
export default function ConsultationFields({ c }: { c: Consultation }) {
  const filled = (defs: FieldDef[]) =>
    defs
      .map((f) => ({ ...f, value: String(c[f.name] ?? "").trim() }))
      .filter((f) => f.value);
  const clinical = filled(CLINICAL);
  const caseNotes = filled(CASE_NOTES);
  const { data: generals } = useConsultationGenerals(c.id);
  const { data: lsmc } = useConsultationLsmc(c.id);
  const hasGenerals = !!generals && !isGeneralsBlank(generals);
  const lsmcRows = lsmc ?? [];

  if (
    clinical.length === 0 &&
    caseNotes.length === 0 &&
    !hasGenerals &&
    lsmcRows.length === 0
  ) {
    return <Typography color="text.secondary">No details recorded</Typography>;
  }

  return (
    <Stack spacing={3}>
      {clinical.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              {clinical.map((f) => (
                <Field key={f.name} label={f.label} value={f.value} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {hasGenerals && (
        <Box>
          <SectionHeading>Generals</SectionHeading>
          <GeneralsView generals={generals} />
        </Box>
      )}

      {lsmcRows.length > 0 && (
        <Box>
          <SectionHeading>LSMC</SectionHeading>
          <LsmcTable rows={lsmcRows} />
        </Box>
      )}

      {caseNotes.length > 0 && (
        <Box>
          <SectionHeading>Case notes</SectionHeading>
          <Stack spacing={1.5}>
            {caseNotes.map((f) => (
              <Field key={f.name} label={f.label} value={f.value} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
