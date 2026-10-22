// Builds the redacted, size-capped case record that is sent to Gemini.
// Never includes: name, phone, place, serialNo, amount, paymentMode, IDs, emails.

type ClinicType = "homoeo" | "general";

export interface PatientInput {
  name: string;
  dob: number | null;
  gender: string;
}
export type Visit = Record<string, unknown> & { date: number; createdAt?: number };
export interface CaseInput {
  type: ClinicType;
  patient: PatientInput;
  consultations: Visit[];
  generals: Record<string, unknown> | null;
  lsmc: Record<string, unknown>[];
  now: number;
}

export const MAX_VISITS = 30;
export const MAX_LSMC = 50;
export const MAX_CHARS = 40_000;

const TZ = "Asia/Kolkata";

export function featuresFor(type: ClinicType) {
  const homoeo = type === "homoeo";
  return { lsmc: homoeo, differentialRemedy: homoeo, homoeoGenerals: homoeo };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redactName(text: string, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return text;
  const parts = trimmed
    .split(/[\s\-'\u2019]+/u)
    .filter((w) => (w.match(/[\p{L}\p{M}]/gu) ?? []).length >= 3);
  const full = trimmed.split(/\s+/u).map(escapeRe).join("\\s+");
  const tokens = trimmed.split(/\s+/u).filter((w) => w.length >= 3);
  const alts = [full, ...tokens.map(escapeRe), ...parts.map(escapeRe)].sort((x, y) => y.length - x.length);
  const re = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{M}\\p{N}])`, "giu");
  return text.replace(re, "the patient");
}

function ymd(ms: number): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

const pad = (n: number) => String(n).padStart(2, "0");
function formatDate(ms: number): string {
  const { y, m, d } = ymd(ms);
  return `${y}-${pad(m)}-${pad(d)}`;
}

function ageLabel(dob: number | null, now: number): string {
  if (dob == null) return "unknown";
  const a = ymd(dob);
  const b = ymd(now);
  let months = (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
  if (months < 0) return "unknown";
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const VISIT_FIELDS: { key: string; label: string; homoeo?: true }[] = [
  { key: "complaint", label: "Complaint" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "testsRequired", label: "Tests required" },
  { key: "remedy", label: "Prescription" },
  { key: "differentialRemedy", label: "Differential remedy", homoeo: true },
  { key: "followupCriteria", label: "Follow-up criteria" },
  { key: "remarks", label: "Remarks" },
  { key: "generals", label: "Generals (legacy)" },
  { key: "allergy", label: "Allergy (legacy)" },
  { key: "history", label: "History (legacy)" },
];

// Labels copied from src/features/consultations/generalsFields.ts.
const GENERALS_FIELDS: { key: string; label: string; generalLabel?: string; homoeo?: true; menstrual?: true }[] = [
  { key: "appetite", label: "Appetite" },
  { key: "thirst", label: "Thirst" },
  { key: "bladder", label: "Bladder" },
  { key: "bowel", label: "Bowel" },
  { key: "sleepDreams", label: "Sleep & dreams", generalLabel: "Sleep" },
  { key: "lmp", label: "LMP", menstrual: true },
  { key: "menarche", label: "Menarche", menstrual: true },
  { key: "menopause", label: "Menopause", menstrual: true },
  { key: "menstrualPain", label: "Menstrual pain", menstrual: true },
  { key: "clots", label: "Clots", menstrual: true },
  { key: "moodSwings", label: "Mood swings", menstrual: true },
  { key: "leucorrhoea", label: "Leucorrhoea", menstrual: true },
  { key: "perspirationOdour", label: "Perspiration odour", homoeo: true },
  { key: "perspirationStaining", label: "Perspiration staining", homoeo: true },
  { key: "perspirationRemarks", label: "Perspiration remarks", homoeo: true },
  { key: "sexualHistory", label: "Sexual history" },
  { key: "pastHistory", label: "Past history" },
  { key: "mentals", label: "Mentals", homoeo: true },
  { key: "allergicHistory", label: "Allergic history" },
];

const LSMC_FIELDS = [
  { key: "location", label: "Location" },
  { key: "sensation", label: "Sensation" },
  { key: "modality", label: "Modality" },
  { key: "concomitant", label: "Concomitant" },
];

export function buildCaseRecord(input: CaseInput): {
  text: string;
  consultationCount: number;
  lastConsultationAt: number | null;
} {
  const { type, patient, now } = input;
  const f = featuresFor(type);
  const redact = (s: string) => redactName(s, patient.name);

  const all = [...input.consultations];
  const consultationCount = all.length;
  const lastConsultationAt = all.length
    ? Math.max(...all.map((v) => (typeof v.createdAt === "number" ? v.createdAt : v.date)))
    : null;
  const newest = all
    .sort((a, b) => b.date - a.date || (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, MAX_VISITS);

  const visitBlock = (v: Visit): string => {
    const lines = [`### ${formatDate(v.date)}`];
    for (const fld of VISIT_FIELDS) {
      if (fld.homoeo && !f.differentialRemedy) continue;
      const val = str(v[fld.key]);
      if (val) lines.push(`${fld.label}: ${redact(val)}`);
    }
    return lines.join("\n");
  };

  const generalsLines: string[] = [];
  if (input.generals) {
    for (const fld of GENERALS_FIELDS) {
      if (fld.homoeo && !f.homoeoGenerals) continue;
      const raw = input.generals[fld.key];
      const label = !f.homoeoGenerals && fld.generalLabel ? fld.generalLabel : fld.label;
      if (fld.key === "lmp") {
        if (typeof raw === "number") generalsLines.push(`${label}: ${formatDate(raw)}`);
        continue;
      }
      const val = str(raw);
      if (val) generalsLines.push(`${label}: ${redact(val)}`);
    }
  }

  const lsmcLines: string[] = [];
  if (f.lsmc) {
    for (const row of input.lsmc.slice(0, MAX_LSMC)) {
      const bits = LSMC_FIELDS.map((fl) => ({ l: fl.label, v: str(row[fl.key]) }))
        .filter((b) => b.v)
        .map((b) => `${b.l}: ${redact(b.v)}`);
      if (bits.length) lsmcLines.push(`- ${bits.join("; ")}`);
    }
  }

  const render = (visits: Visit[]): string => {
    const out = [`Age: ${ageLabel(patient.dob, now)}`, `Gender: ${patient.gender || "unknown"}`, "", "## Consultations (newest first)"];
    out.push(visits.length ? visits.map(visitBlock).join("\n\n") : "No consultations recorded");
    out.push("", "## Generals", generalsLines.length ? generalsLines.join("\n") : "None recorded");
    if (f.lsmc) out.push("", "## LSMC", lsmcLines.length ? lsmcLines.join("\n") : "None recorded");
    return out.join("\n");
  };

  let visits = newest;
  let text = render(visits);
  while (text.length > MAX_CHARS && visits.length > 1) {
    visits = visits.slice(0, -1);
    text = render(visits);
  }
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
  return { text, consultationCount, lastConsultationAt };
}

export function systemInstruction(type: ClinicType): string {
  if (type === "general") {
    return (
      "You are assisting a general practice doctor. From the case record below, write 4-6 short bullet points " +
      "giving the doctor an at-a-glance picture of this patient. Prioritise chronic conditions, allergies, " +
      "medications, significant past history, red flags and how the case has progressed. Use only facts in the " +
      "record. Do not guess, diagnose or recommend treatment. If the record is thin, say so in one bullet. " +
      "Plain English, no patient name."
    );
  }
  return (
    "You are assisting a homoeopathic doctor. From the case record below, write 4-6 short bullet points " +
    "giving the doctor an at-a-glance picture of this patient. Prioritise what is peculiar, rare, strange or " +
    "characteristic: unusual symptoms, marked mentals/emotional state, striking modalities, concomitants, " +
    "allergies, significant past history, chronic conditions and how the case has progressed. Use only facts " +
    "in the record. Do not guess, diagnose or recommend treatment. If the record is thin, say so in one " +
    "bullet. Plain English, no patient name."
  );
}
