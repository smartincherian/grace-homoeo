import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { realDeps, type Deps } from "./deps.js";
import * as h from "./handlers.js";
import { safeClinicId, safePatientId } from "./logIds.js";

setGlobalOptions({ region: "asia-south1", maxInstances: 5 });

let cached: Deps | undefined;
const deps = (): Deps => (cached ??= realDeps());

const GENERIC = "The summary couldn't be generated, try again.";

/** Runs a handler; HttpsError passes through, anything else becomes a generic internal error. Never logs messages. */
async function run<T>(
  name: string,
  data: { clinicId?: unknown; patientId?: unknown } | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const ids = {
    clinicId: safeClinicId(data?.clinicId),
    patientId: safePatientId(data?.patientId),
  };
  try {
    const res = await fn();
    logger.info(name, { ...ids, ok: true });
    return res;
  } catch (e) {
    const code = e instanceof HttpsError ? e.code : (e as { name?: string })?.name ?? "unknown";
    logger.info(name, { ...ids, ok: false, code });
    if (e instanceof HttpsError) throw e;
    throw new HttpsError("internal", GENERIC);
  }
}

export const saveAiKey = onCall({ enforceAppCheck: false }, (req) =>
  run("saveAiKey", req.data, () => h.saveAiKey(deps(), req.auth, req.data)),
);
export const removeAiKey = onCall({ enforceAppCheck: false }, (req) =>
  run("removeAiKey", req.data, () => h.removeAiKey(deps(), req.auth, req.data)),
);
export const summarizePatient = onCall({ enforceAppCheck: false }, (req) =>
  run("summarize", req.data, () => h.summarizePatient(deps(), req.auth, req.data)),
);
export const cleanupClinic = onDocumentDeleted("clinics/{clinicId}", (e) =>
  h.cleanupClinic(deps(), e.params.clinicId),
);
