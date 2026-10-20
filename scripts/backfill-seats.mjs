// One-off: gives an existing clinic its owner + seats (the 3-user cap model).
// Usage: npm run backfill:seats -- --clinic grace-homoeo --owner owner@example.com --project grace-homoeo [--dry-run]
// Credentials: Application Default Credentials (gcloud auth application-default login),
// or set FIRESTORE_EMULATOR_HOST to target the local emulator.
// Seat "1" = owner; "2"/"3" = the other allowed emails, alphabetical.
// Aborts if >3 emails, owner missing, superadmin present, or seats already exist.
import { parseArgs } from "node:util";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Keep in sync with src/lib/access.ts.
const SUPERADMIN_EMAIL = "smartin.cherian@gmail.com";
const MAX_SEATS = 3;

const { values } = parseArgs({
  options: {
    clinic: { type: "string" },
    owner: { type: "string" },
    project: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const { clinic, project } = values;
const owner = values.owner?.trim().toLowerCase();
const dryRun = values["dry-run"];
const emulator = process.env.FIRESTORE_EMULATOR_HOST;

if (!clinic || !owner) {
  console.error("--clinic and --owner are required.");
  process.exit(2);
}
if (!emulator && !project) {
  console.error(
    "No FIRESTORE_EMULATOR_HOST set: pass an explicit --project (this would target real Firestore).",
  );
  process.exit(2);
}

initializeApp({ projectId: project ?? "demo-grace" });
const db = getFirestore();
console.log(
  `Target: ${emulator ? `emulator ${emulator}` : `PRODUCTION project ${project}`}  clinic: ${clinic}${dryRun ? "  (dry run)" : ""}\n`,
);

const clinicRef = db.collection("clinics").doc(clinic);
if (!(await clinicRef.get()).exists) {
  console.error(`ABORT: clinics/${clinic} does not exist.`);
  process.exit(1);
}
const existingSeats = await clinicRef.collection("seats").listDocuments();
if (existingSeats.length > 0) {
  console.error(
    `ABORT: seats already exist for clinic ${clinic} (${existingSeats.map((r) => r.id).join(", ")}).`,
  );
  process.exit(1);
}

const docs = (
  await db.collection("allowedEmails").where("clinicId", "==", clinic).get()
).docs;
const emails = docs.map((d) => d.id.toLowerCase()).sort();
const list = emails.join(", ") || "(none)";
if (emails.length > MAX_SEATS) {
  console.error(
    `ABORT: ${emails.length} allowed emails for ${clinic}, max ${MAX_SEATS}. Remove extras first: ${list}`,
  );
  process.exit(1);
}
if (emails.includes(SUPERADMIN_EMAIL)) {
  console.error(
    `ABORT: the superadmin email ${SUPERADMIN_EMAIL} is in this clinic's allow-list. Remove it first: ${list}`,
  );
  process.exit(1);
}
if (!emails.includes(owner)) {
  console.error(
    `ABORT: owner ${owner} is not among the clinic's allowed emails: ${list}`,
  );
  process.exit(1);
}

const ordered = [owner, ...emails.filter((e) => e !== owner)];
const plan = ordered.map((email, i) => ({ seat: String(i + 1), email }));
console.log("seat | email");
for (const p of plan)
  console.log(
    `${p.seat.padStart(4)} | ${p.email}${p.seat === "1" ? "  (owner)" : ""}`,
  );

if (dryRun) {
  console.log("\nDry run: nothing written.");
  process.exit(0);
}

const batch = db.batch();
for (const p of plan) {
  batch.set(clinicRef.collection("seats").doc(p.seat), { email: p.email });
  const src = docs.find((d) => d.id.toLowerCase() === p.email);
  batch.update(src.ref, { seat: p.seat, email: src.id });
}
batch.update(clinicRef, { ownerEmail: owner, timeZone: "Asia/Kolkata" });
await batch.commit();
console.log(
  `\nOK: wrote ${plan.length} seat(s), ownerEmail and timeZone on clinics/${clinic}.`,
);
