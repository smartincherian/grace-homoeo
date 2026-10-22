import { HttpsError } from "firebase-functions/v2/https";
import type { Store } from "./deps.js";

export const HOUR_LIMIT = 30;
export const DAY_LIMIT = 200;
export const SAME_PATIENT_MS = 20_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const limited = (nextWindowStart: number, now: number) =>
  new HttpsError(
    "resource-exhausted",
    `Summary limit reached, try again in ${Math.max(1, Math.ceil((nextWindowStart - now) / 60_000))} minutes.`,
  );

/** Per-clinic quota check and count, in one transaction. Throws resource-exhausted when over a limit. */
export async function checkAndCount(store: Store, clinicId: string, patientId: string, now: number): Promise<void> {
  const path = `aiUsage/${clinicId}`;
  await store.transaction(async (tx) => {
    const cur = (await tx.get(path)) ?? {};
    const hourKey = Math.floor(now / HOUR_MS);
    const dayKey = Math.floor(now / DAY_MS);
    const hourCount = cur.hourKey === hourKey ? Number(cur.hourCount ?? 0) : 0;
    const dayCount = cur.dayKey === dayKey ? Number(cur.dayCount ?? 0) : 0;
    const prev = (cur.lastByPatient ?? {}) as Record<string, number>;

    const last = prev[patientId];
    if (typeof last === "number" && now - last < SAME_PATIENT_MS) {
      throw new HttpsError("resource-exhausted", "A summary was just requested, wait a moment.");
    }
    if (dayCount >= DAY_LIMIT) throw limited((dayKey + 1) * DAY_MS, now);
    if (hourCount >= HOUR_LIMIT) throw limited((hourKey + 1) * HOUR_MS, now);

    const lastByPatient: Record<string, number> = {};
    for (const [id, t] of Object.entries(prev)) if (now - t < HOUR_MS) lastByPatient[id] = t;
    lastByPatient[patientId] = now;

    await tx.set(path, { hourKey, hourCount: hourCount + 1, dayKey, dayCount: dayCount + 1, lastByPatient });
  });
}
