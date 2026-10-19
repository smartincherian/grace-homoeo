import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const SUPER = "smartin.cherian@gmail.com";

function dbFor(email: string, extra: Record<string, unknown> = {}, uid = email) {
  return env
    .authenticatedContext(uid, {
      email,
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
      ...extra,
    })
    .firestore();
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-grace",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "allowedEmails/a@x.com"), { clinicId: "c1" });
    await setDoc(doc(db, "allowedEmails/nocl@x.com"), {});
    await setDoc(doc(db, "clinics/c1"), { name: "One" });
    await setDoc(doc(db, "clinics/c2"), { name: "Two" });
    await setDoc(doc(db, "clinics/c1/patients/p1"), { name: "P1" });
    await setDoc(doc(db, "clinics/c2/patients/p2"), { name: "P2" });
    await setDoc(doc(db, "patients/legacy"), { name: "Legacy" });
  });
});

describe("clinic member (a@x.com, clinic c1)", () => {
  it("reads and writes own clinic data and gets own clinic doc", async () => {
    const db = dbFor("a@x.com");
    await assertSucceeds(getDoc(doc(db, "clinics/c1/patients/p1")));
    await assertSucceeds(setDoc(doc(db, "clinics/c1/patients/new"), { name: "N" }));
    await assertSucceeds(getDoc(doc(db, "clinics/c1")));
  });

  it("cannot touch another clinic", async () => {
    const db = dbFor("a@x.com");
    await assertFails(getDoc(doc(db, "clinics/c2/patients/p2")));
    await assertFails(setDoc(doc(db, "clinics/c2/patients/x"), { name: "X" }));
    await assertFails(getDoc(doc(db, "clinics/c2")));
    await assertFails(getDocs(collection(db, "clinics/c2/patients")));
  });

  it("cannot list clinics, write clinic docs, or read legacy collections", async () => {
    const db = dbFor("a@x.com");
    await assertFails(getDocs(collection(db, "clinics")));
    await assertFails(setDoc(doc(db, "clinics/c1"), { name: "Renamed" }));
    await assertFails(getDoc(doc(db, "patients/legacy")));
  });

  it("cannot reassign their own clinic via the allow list", async () => {
    const db = dbFor("a@x.com");
    await assertFails(updateDoc(doc(db, "allowedEmails/a@x.com"), { clinicId: "c2" }));
  });

  it("can read their own allow-list entry", async () => {
    await assertSucceeds(getDoc(doc(dbFor("a@x.com"), "allowedEmails/a@x.com")));
  });

  it("can write only their own users doc", async () => {
    const db = dbFor("a@x.com", {}, "uid-a");
    await assertSucceeds(setDoc(doc(db, "users/uid-a"), { role: "admin" }));
    await assertFails(setDoc(doc(db, "users/other"), { role: "admin" }));
  });
});

describe("denied callers", () => {
  it("member without a clinicId is denied", async () => {
    await assertFails(getDoc(doc(dbFor("nocl@x.com"), "clinics/c1/patients/p1")));
  });

  it("unlisted email is denied", async () => {
    await assertFails(getDoc(doc(dbFor("unlisted@x.com"), "clinics/c1/patients/p1")));
  });

  it("unverified google token for a listed email is denied", async () => {
    const db = dbFor("a@x.com", { email_verified: false });
    await assertFails(getDoc(doc(db, "clinics/c1/patients/p1")));
    await assertFails(getDoc(doc(db, "clinics/c1")));
  });

  it("signed-out caller is denied", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "clinics/c1/patients/p1")));
  });
});

describe("superadmin", () => {
  it("reads any clinic, lists clinics, creates clinics, manages allow list", async () => {
    const db = dbFor(SUPER);
    await assertSucceeds(getDoc(doc(db, "clinics/c2/patients/p2")));
    await assertSucceeds(getDocs(collection(db, "clinics")));
    await assertSucceeds(setDoc(doc(db, "clinics/c3"), { name: "Three" }));
    await assertSucceeds(setDoc(doc(db, "allowedEmails/b@x.com"), { clinicId: "c3" }));
  });
});
