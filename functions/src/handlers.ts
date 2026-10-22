import { HttpsError } from "firebase-functions/v2/https";
import type { Deps } from "./deps.js";
import { assertAccess } from "./access.js";
import { buildCaseRecord, systemInstruction, type Visit } from "./caseRecord.js";
import { GEMINI_MODEL, generateBullets, validateGeminiKey } from "./gemini.js";
import { checkAndCount } from "./rateLimit.js";


type Auth = { token: { email?: string; email_verified?: boolean; name?: string } } | undefined;

export interface AiStatus {
  provider: "gemini";
  configured: boolean;
  last4: string;
  model: string;
  updatedAt: number;
  updatedBy: string;
}
export interface SummaryDoc {
  bullets: string[];
  generatedAt: number;
  generatedBy: string;
  generatedByName: string;
  model: string;
  consultationCount: number;
  lastConsultationAt: number | null;
}

const GENERIC = "The summary couldn't be generated, try again.";
const BAD_KEY = "That doesn't look like a Gemini API key.";
export const PATIENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

type Data = Record<string, unknown> | undefined | null;
const field = (data: Data, k: string): unknown => (data && typeof data === "object" ? data[k] : undefined);

export async function saveAiKey(deps: Deps, auth: Auth, data: Data): Promise<AiStatus> {
  const { caller, clinic } = await assertAccess(deps, auth, field(data, "clinicId"), { owner: true, write: true });
  const raw = field(data, "apiKey");
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key.length < 20 || key.length > 200 || !/^\S+$/.test(key)) {
    throw new HttpsError("invalid-argument", BAD_KEY);
  }
  await validateGeminiKey(deps.fetch, key);
  const ciphertext = await deps.kms.encrypt(key, clinic.id);
  const now = deps.now();
  const status: AiStatus = {
    provider: "gemini",
    configured: true,
    last4: key.slice(-4),
    model: GEMINI_MODEL,
    updatedAt: now,
    updatedBy: caller.email,
  };
  await deps.store.set(`aiSecrets/${clinic.id}`, {
    provider: "gemini",
    ciphertext,
    updatedAt: now,
    updatedBy: caller.email,
  });
  await deps.store.set(`clinics/${clinic.id}/settings/ai`, status as unknown as Record<string, unknown>);
  return status;
}

export async function removeAiKey(deps: Deps, auth: Auth, data: Data): Promise<AiStatus> {
  const { caller, clinic } = await assertAccess(deps, auth, field(data, "clinicId"), { owner: true });
  const status: AiStatus = {
    provider: "gemini",
    configured: false,
    last4: "",
    model: GEMINI_MODEL,
    updatedAt: deps.now(),
    updatedBy: caller.email,
  };
  await deps.store.delete(`aiSecrets/${clinic.id}`);
  await deps.store.set(`clinics/${clinic.id}/settings/ai`, status as unknown as Record<string, unknown>);
  return status;
}

export async function summarizePatient(deps: Deps, auth: Auth, data: Data): Promise<SummaryDoc> {
  const { caller, clinic } = await assertAccess(deps, auth, field(data, "clinicId"), { write: true });
  const patientId = field(data, "patientId");
  if (typeof patientId !== "string" || !PATIENT_ID.test(patientId)) {
    throw new HttpsError("invalid-argument", "Invalid patient.");
  }
  const base = `clinics/${clinic.id}`;
  const patient = await deps.store.get(`${base}/patients/${patientId}`);
  if (!patient) throw new HttpsError("not-found", "Patient not found.");
  const secret = await deps.store.get(`aiSecrets/${clinic.id}`);
  if (!secret || typeof secret.ciphertext !== "string") {
    throw new HttpsError("failed-precondition", "AI summary is off. Ask the owner to add a Gemini key in Settings.", {
      reason: "no-key",
    });
  }
  await checkAndCount(deps.store, clinic.id, patientId, deps.now());

  let key: string;
  try {
    key = await deps.kms.decrypt(secret.ciphertext, clinic.id);
  } catch {
    throw new HttpsError("internal", GENERIC);
  }

  const [consultations, lsmc, generalsAll] = await Promise.all([
    deps.store.query(`${base}/consultations`, "patientId", patientId),
    deps.store.query(`${base}/lsmc`, "patientId", patientId),
    deps.store.query(`${base}/generals`, "patientId", patientId),
  ]);
  const generals = generalsAll.reduce<Record<string, unknown> | null>(
    (best, g) => (best === null || Number(g.date ?? 0) > Number(best.date ?? 0) ? g : best),
    null,
  );
  const now = deps.now();
  const record = buildCaseRecord({
    type: clinic.type,
    patient: {
      name: String(patient.name ?? ""),
      dob: typeof patient.dob === "number" ? patient.dob : null,
      gender: String(patient.gender ?? ""),
    },
    consultations: consultations as Visit[],
    generals,
    lsmc,
    now,
  });
  const bullets = await generateBullets(deps.fetch, key, systemInstruction(clinic.type), record.text);

  const doc: SummaryDoc = {
    bullets,
    generatedAt: now,
    generatedBy: caller.email,
    generatedByName: caller.name || caller.email,
    model: GEMINI_MODEL,
    consultationCount: record.consultationCount,
    lastConsultationAt: record.lastConsultationAt,
  };
  await deps.store.set(`${base}/patientSummaries/${patientId}`, doc as unknown as Record<string, unknown>);
  return doc;
}

export async function cleanupClinic(deps: Deps, clinicId: string): Promise<void> {
  await deps.store.delete(`aiSecrets/${clinicId}`);
  await deps.store.delete(`aiUsage/${clinicId}`);
}
