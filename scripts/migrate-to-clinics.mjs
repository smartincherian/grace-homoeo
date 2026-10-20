// Copies the legacy single-clinic top-level data into clinics/{clinicId}/...
// Usage: npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" [--dry-run] [--resync] --project grace-homoeo
// Credentials: Application Default Credentials (gcloud auth application-default login),
// or set FIRESTORE_EMULATOR_HOST to target the local emulator.
// Aborts if the destination already has data; --resync (pre-deploy re-run ONLY, never after cutover) overrides.
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Keep in sync with src/lib/clinic.ts.
const RESERVED_SLUGS = ["login", "admin", "access", "patients", "inventory", "calculator", "funds", "clinics", "people", "settings", "verify-email"];
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
    project: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    resync: { type: "boolean", default: false },
  },
});
const { clinic, name, project } = values;
const dryRun = values["dry-run"];
const resync = values.resync;
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (!isValidSlug(clinic)) {
  console.error(`Invalid or missing --clinic "${clinic ?? ""}": use 3-40 chars a-z, 0-9, hyphens; not reserved (${RESERVED_SLUGS.join(", ")}).`);
  process.exit(2);
}
if (!dryRun && !name?.trim()) {
  console.error("--name is required (unless --dry-run).");
  process.exit(2);
}
if (!emulator && !project) {
  console.error("No FIRESTORE_EMULATOR_HOST set: pass an explicit --project (this would target real Firestore).");
  process.exit(2);
}

initializeApp({ projectId: project ?? "demo-grace" });
const db = getFirestore();
console.log(`Target: ${emulator ? `emulator ${emulator}` : `PRODUCTION project ${project}`}  clinic: ${clinic}${dryRun ? "  (dry run)" : ""}${resync ? "  (resync)" : ""}\n`);

const clinicRef = db.collection("clinics").doc(clinic);
const counterSrc = db.collection("counters").doc("patients");
const counterDest = clinicRef.collection("counters").doc("patients");

// Load sources and current destination state.
const sources = {};
for (const col of COLLECTIONS) sources[col] = (await db.collection(col).get()).docs;
const counterSnap = await counterSrc.get();
const destExisting = {};
for (const col of COLLECTIONS) destExisting[col] = (await clinicRef.collection(col).listDocuments()).length;
const counterDestSnap = await counterDest.get();
const destHasData = Object.values(destExisting).some((n) => n > 0) || counterDestSnap.exists;

if (!counterSnap.exists && sources.patients.length > 0) {
  console.error("WARNING: source counters/patients is missing but patients exist. Patient serials would restart; refusing to continue.");
  process.exit(1);
}
if (destHasData && !resync) {
  console.error(
    `ABORT: clinics/${clinic} already contains data. Re-running would overwrite live edits with stale legacy copies and could lower the serial counter.\n` +
      "Use --resync only for a re-run BEFORE deploying the new rules; never after cutover."
  );
  process.exit(dryRun ? 0 : 1);
}

if (!dryRun) {
  if (!(await clinicRef.get()).exists) {
    await clinicRef.set({ name: name.trim(), createdAt: Date.now() });
    console.log(`Created clinics/${clinic}`);
  }
  for (const col of COLLECTIONS) {
    const docs = sources[col];
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const d of docs.slice(i, i + BATCH_SIZE)) batch.set(clinicRef.collection(col).doc(d.id), d.data());
      await batch.commit();
    }
  }
  if (counterSnap.exists) {
    // Never lower an existing counter.
    const srcSerial = counterSnap.data().lastSerial ?? 0;
    const destSerial = counterDestSnap.exists ? (counterDestSnap.data().lastSerial ?? 0) : 0;
    await counterDest.set({ ...counterSnap.data(), lastSerial: Math.max(srcSerial, destSerial) });
  }
  // allowedEmails: assign the clinic where none is set
  const allowed = await db.collection("allowedEmails").get();
  const lacking = allowed.docs.filter((d) => !d.data().clinicId);
  for (let i = 0; i < lacking.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const d of lacking.slice(i, i + BATCH_SIZE)) batch.update(d.ref, { clinicId: clinic });
    await batch.commit();
  }
  console.log(`allowedEmails given clinicId: ${lacking.length}\n`);
}

// Verify: every source doc ID must exist at the destination.
const rows = [];
let bad = false;
for (const col of COLLECTIONS) {
  const source = sources[col].length;
  if (dryRun) {
    rows.push({ collection: col, source, dest: "-", missing: "-" });
    continue;
  }
  const destIds = new Set((await clinicRef.collection(col).listDocuments()).map((r) => r.id));
  const missing = sources[col].filter((d) => !destIds.has(d.id)).length;
  if (missing > 0) bad = true;
  rows.push({ collection: col, source, dest: destIds.size, missing });
}
if (dryRun) {
  rows.push({ collection: "counters/patients", source: counterSnap.exists ? 1 : 0, dest: "-", missing: "-" });
} else {
  const d = await counterDest.get();
  const ok = counterSnap.exists ? d.exists && (d.data().lastSerial ?? 0) >= (counterSnap.data().lastSerial ?? 0) : true;
  if (!ok) bad = true;
  rows.push({ collection: "counters/patients", source: counterSnap.exists ? 1 : 0, dest: d.exists ? 1 : 0, missing: ok ? 0 : 1 });
}

const w = Math.max(...rows.map((r) => r.collection.length), 10);
console.log(`${"collection".padEnd(w)} | source | destination | missing`);
for (const r of rows) console.log(`${r.collection.padEnd(w)} | ${String(r.source).padStart(6)} | ${String(r.dest).padStart(11)} | ${r.missing}`);
if (bad) {
  console.error("\nMISMATCH: some source docs are missing at the destination (or the counter is behind).");
  process.exit(1);
}
console.log(dryRun ? "\nDry run: nothing written." : "\nOK: every source doc exists at the destination.");
