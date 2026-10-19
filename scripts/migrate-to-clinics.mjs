// Copies the legacy single-clinic top-level data into clinics/{clinicId}/...
// Usage: npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" [--dry-run] [--project grace-homoeo]
// Credentials: Application Default Credentials (gcloud auth application-default login),
// or set FIRESTORE_EMULATOR_HOST to target the local emulator. Safe to re-run.
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Keep in sync with src/lib/clinic.ts.
const RESERVED_SLUGS = ["login", "admin", "access", "patients", "inventory", "calculator", "funds", "clinics"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLLECTIONS = ["patients", "consultations", "generals", "lsmc", "inventory", "orderItems", "expenses"];
const BATCH_SIZE = 500;

function isValidSlug(s) {
  return typeof s === "string" && s.length >= 3 && s.length <= 40 && SLUG_RE.test(s) && !RESERVED_SLUGS.includes(s);
}

const { values } = parseArgs({
  options: {
    clinic: { type: "string" },
    name: { type: "string" },
    project: { type: "string", default: "grace-homoeo" },
    "dry-run": { type: "boolean", default: false },
  },
});
const { clinic, name, project } = values;
const dryRun = values["dry-run"];

if (!isValidSlug(clinic)) {
  console.error(`Invalid or missing --clinic "${clinic ?? ""}": use 3-40 chars a-z, 0-9, hyphens; not reserved (${RESERVED_SLUGS.join(", ")}).`);
  process.exit(2);
}
if (!dryRun && !name?.trim()) {
  console.error("--name is required (unless --dry-run).");
  process.exit(2);
}

initializeApp({ projectId: project });
const db = getFirestore();
const target = process.env.FIRESTORE_EMULATOR_HOST
  ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}`
  : `PRODUCTION project ${project}`;
console.log(`Target: ${target}  clinic: ${clinic}${dryRun ? "  (dry run)" : ""}\n`);

const clinicRef = db.collection("clinics").doc(clinic);

async function copyCollection(col) {
  const snap = await db.collection(col).get();
  if (!dryRun) {
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + BATCH_SIZE)) {
        batch.set(clinicRef.collection(col).doc(d.id), d.data());
      }
      await batch.commit();
    }
  }
  const dest = dryRun ? null : (await clinicRef.collection(col).count().get()).data().count;
  return { source: snap.size, dest };
}

const rows = [];

if (!dryRun) {
  if (!(await clinicRef.get()).exists) {
    await clinicRef.set({ name: name.trim(), createdAt: Date.now() });
    console.log(`Created clinics/${clinic}`);
  }
}

for (const col of COLLECTIONS) rows.push({ collection: col, ...(await copyCollection(col)) });

// counters/patients -> clinics/{id}/counters/patients
const counterSnap = await db.collection("counters").doc("patients").get();
if (counterSnap.exists && !dryRun) await clinicRef.collection("counters").doc("patients").set(counterSnap.data());
const counterDest = dryRun ? null : (await clinicRef.collection("counters").doc("patients").get()).exists ? 1 : 0;
rows.push({ collection: "counters/patients", source: counterSnap.exists ? 1 : 0, dest: counterDest });

// allowedEmails: assign the clinic where none is set
const allowed = await db.collection("allowedEmails").get();
const lacking = allowed.docs.filter((d) => !d.data().clinicId);
if (!dryRun) {
  for (let i = 0; i < lacking.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const d of lacking.slice(i, i + BATCH_SIZE)) batch.update(d.ref, { clinicId: clinic });
    await batch.commit();
  }
}
console.log(`allowedEmails lacking clinicId: ${lacking.length}${dryRun ? " (would be set)" : " (set)"}\n`);

const w = Math.max(...rows.map((r) => r.collection.length), 10);
console.log(`${"collection".padEnd(w)} | source | destination`);
let short = false;
for (const r of rows) {
  if (r.dest !== null && r.dest < r.source) short = true;
  console.log(`${r.collection.padEnd(w)} | ${String(r.source).padStart(6)} | ${r.dest === null ? "-" : r.dest}`);
}
if (short) {
  console.error("\nMISMATCH: some destination counts are below source counts.");
  process.exit(1);
}
console.log(dryRun ? "\nDry run: nothing written." : "\nOK: destination counts cover source counts.");
