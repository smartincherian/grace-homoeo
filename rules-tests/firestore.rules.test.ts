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
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const SUPER = "smartin.cherian@gmail.com";

function addUser(db: Firestore, clinic: string, seat: string, email: string) {
  const b = writeBatch(db);
  b.set(doc(db, `clinics/${clinic}/seats/${seat}`), { email });
  b.set(doc(db, `allowedEmails/${email}`), {
    email,
    clinicId: clinic,
    seat,
    addedAt: 1,
    addedBy: "x",
  });
  return b.commit();
}

function removeUser(
  db: Firestore,
  clinic: string,
  seat: string,
  email: string,
) {
  const b = writeBatch(db);
  b.delete(doc(db, `clinics/${clinic}/seats/${seat}`));
  b.delete(doc(db, `allowedEmails/${email}`));
  return b.commit();
}

function dbFor(
  email: string,
  extra: Record<string, unknown> = {},
  uid = email,
) {
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
    await setDoc(doc(db, "clinics/c1"), { name: "One", ownerEmail: "o@x.com" });
    await setDoc(doc(db, "clinics/c2"), { name: "Two", ownerEmail: "t@x.com" });
    await setDoc(doc(db, "allowedEmails/o@x.com"), {
      email: "o@x.com",
      clinicId: "c1",
      seat: "1",
    });
    await setDoc(doc(db, "allowedEmails/a@x.com"), {
      email: "a@x.com",
      clinicId: "c1",
      seat: "2",
    });
    await setDoc(doc(db, "allowedEmails/t@x.com"), {
      email: "t@x.com",
      clinicId: "c2",
      seat: "1",
    });
    await setDoc(doc(db, "allowedEmails/nocl@x.com"), {});
    await setDoc(doc(db, "allowedEmails/empty@x.com"), {
      email: "empty@x.com",
      clinicId: "",
    });
    await setDoc(doc(db, "clinics/c1/seats/1"), { email: "o@x.com" });
    await setDoc(doc(db, "clinics/c1/seats/2"), { email: "a@x.com" });
    await setDoc(doc(db, "clinics/c2/seats/1"), { email: "t@x.com" });
    await setDoc(doc(db, "clinics/c1/patients/p1"), { name: "P1" });
    await setDoc(doc(db, "clinics/c2/patients/p2"), { name: "P2" });
    await setDoc(doc(db, "patients/legacy"), { name: "Legacy" });
  });
});

describe("clinic member (a@x.com, clinic c1)", () => {
  it("reads and writes own clinic data and gets own clinic doc", async () => {
    const db = dbFor("a@x.com");
    await assertSucceeds(getDoc(doc(db, "clinics/c1/patients/p1")));
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/patients/new"), { name: "N" }),
    );
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
    await assertFails(
      updateDoc(doc(db, "allowedEmails/a@x.com"), { clinicId: "c2" }),
    );
  });

  it("can read their own allow-list entry", async () => {
    await assertSucceeds(
      getDoc(doc(dbFor("a@x.com"), "allowedEmails/a@x.com")),
    );
  });

  it("can write only their own users doc", async () => {
    const db = dbFor("a@x.com", {}, "uid-a");
    await assertSucceeds(setDoc(doc(db, "users/uid-a"), { role: "admin" }));
    await assertFails(setDoc(doc(db, "users/other"), { role: "admin" }));
  });
});

describe("denied callers", () => {
  it("member without a clinicId is denied", async () => {
    await assertFails(
      getDoc(doc(dbFor("nocl@x.com"), "clinics/c1/patients/p1")),
    );
  });

  it("unlisted email is denied", async () => {
    await assertFails(
      getDoc(doc(dbFor("unlisted@x.com"), "clinics/c1/patients/p1")),
    );
  });

  it("unverified google token for a listed email is denied", async () => {
    const db = dbFor("a@x.com", { email_verified: false });
    await assertFails(getDoc(doc(db, "clinics/c1/patients/p1")));
    await assertFails(getDoc(doc(db, "clinics/c1")));
  });

  it("unverified password account for a listed email is denied", async () => {
    const db = dbFor("a@x.com", {
      email_verified: false,
      firebase: { sign_in_provider: "password" },
    });
    await assertFails(getDoc(doc(db, "clinics/c1/patients/p1")));
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
    // A bare allow-list entry without a matching seat is rejected.
    await assertFails(
      setDoc(doc(db, "allowedEmails/b@x.com"), { clinicId: "c3" }),
    );
  });

  it("deletes an orphan entry with an empty clinicId", async () => {
    await assertSucceeds(
      deleteDoc(doc(dbFor(SUPER), "allowedEmails/empty@x.com")),
    );
  });

  it("deletes an orphan entry with no clinicId field", async () => {
    await assertSucceeds(
      deleteDoc(doc(dbFor(SUPER), "allowedEmails/nocl@x.com")),
    );
  });

  it("sets ownerEmail to a member of the clinic", async () => {
    await assertSucceeds(
      updateDoc(doc(dbFor(SUPER), "clinics/c1"), { ownerEmail: "a@x.com" }),
    );
  });

  it("cannot set ownerEmail to someone outside the clinic", async () => {
    await assertFails(
      updateDoc(doc(dbFor(SUPER), "clinics/c1"), { ownerEmail: "t@x.com" }),
    );
  });

  it("creates a clinic with its owner's seat and allow-list entry in one batch", async () => {
    const db = dbFor(SUPER);
    const b = writeBatch(db);
    b.set(doc(db, "clinics/c3"), {
      name: "Three",
      createdAt: 1,
      ownerEmail: "n@x.com",
    });
    b.set(doc(db, "clinics/c3/seats/1"), { email: "n@x.com" });
    b.set(doc(db, "allowedEmails/n@x.com"), {
      email: "n@x.com",
      clinicId: "c3",
      seat: "1",
      addedAt: 1,
      addedBy: SUPER,
    });
    await assertSucceeds(b.commit());
  });
});

describe("clinic owner (o@x.com, clinic c1)", () => {
  it("adds a user to a free seat", async () => {
    await assertSucceeds(addUser(dbFor("o@x.com"), "c1", "3", "n@x.com"));
  });

  it("cannot add to a seat beyond 3", async () => {
    await assertFails(addUser(dbFor("o@x.com"), "c1", "4", "n@x.com"));
  });

  it("cannot add when all seats are full", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "clinics/c1/seats/3"), { email: "z@x.com" });
      await setDoc(doc(db, "allowedEmails/z@x.com"), {
        email: "z@x.com",
        clinicId: "c1",
        seat: "3",
      });
    });
    const db = dbFor("o@x.com");
    for (const seat of ["1", "2", "3"]) {
      await assertFails(addUser(db, "c1", seat, "n@x.com"));
    }
  });

  it("cannot write only half of the add batch", async () => {
    const db = dbFor("o@x.com");
    await assertFails(
      setDoc(doc(db, "clinics/c1/seats/3"), { email: "n@x.com" }),
    );
    await assertFails(
      setDoc(doc(db, "allowedEmails/n@x.com"), {
        email: "n@x.com",
        clinicId: "c1",
        seat: "3",
        addedAt: 1,
        addedBy: "x",
      }),
    );
  });

  it("cannot add an email that already belongs to another clinic", async () => {
    await assertFails(addUser(dbFor("o@x.com"), "c1", "3", "t@x.com"));
  });

  it("cannot add the superadmin", async () => {
    await assertFails(addUser(dbFor("o@x.com"), "c1", "3", SUPER));
  });

  it("removes a member", async () => {
    await assertSucceeds(removeUser(dbFor("o@x.com"), "c1", "2", "a@x.com"));
  });

  it("cannot remove with only half of the batch", async () => {
    const db = dbFor("o@x.com");
    await assertFails(deleteDoc(doc(db, "clinics/c1/seats/2")));
    await assertFails(deleteDoc(doc(db, "allowedEmails/a@x.com")));
  });

  it("cannot remove a user of another clinic", async () => {
    await assertFails(removeUser(dbFor("o@x.com"), "c2", "1", "t@x.com"));
  });

  it("cannot delete an orphan allow-list entry", async () => {
    const db = dbFor("o@x.com");
    await assertFails(deleteDoc(doc(db, "allowedEmails/empty@x.com")));
    await assertFails(deleteDoc(doc(db, "allowedEmails/nocl@x.com")));
  });

  it("cannot remove themselves", async () => {
    await assertFails(removeUser(dbFor("o@x.com"), "c1", "1", "o@x.com"));
  });

  it("cannot update the clinic doc", async () => {
    const db = dbFor("o@x.com");
    await assertFails(updateDoc(doc(db, "clinics/c1"), { name: "Renamed" }));
    await assertFails(
      updateDoc(doc(db, "clinics/c1"), { ownerEmail: "a@x.com" }),
    );
  });
});

describe("seats and subcollections", () => {
  it("a plain member cannot remove anyone", async () => {
    await assertFails(removeUser(dbFor("a@x.com"), "c1", "2", "a@x.com"));
    await assertFails(removeUser(dbFor("a@x.com"), "c1", "1", "o@x.com"));
  });

  it("a plain member cannot add a user", async () => {
    await assertFails(addUser(dbFor("a@x.com"), "c1", "3", "n@x.com"));
  });

  it("members read their own clinic's seats only", async () => {
    await assertSucceeds(getDoc(doc(dbFor("a@x.com"), "clinics/c1/seats/1")));
    await assertFails(getDoc(doc(dbFor("t@x.com"), "clinics/c1/seats/1")));
  });

  it("members cannot write unknown subcollections", async () => {
    await assertFails(
      setDoc(doc(dbFor("a@x.com"), "clinics/c1/unknownSub/x"), { a: 1 }),
    );
  });

  it("members write expenses and the patient counter", async () => {
    const db = dbFor("a@x.com");
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/expenses/e1"), { amount: 1 }),
    );
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/counters/patients"), { lastSerial: 1 }),
    );
  });
});

describe("branding settings", () => {
  const path = "clinics/c1/settings/branding";
  const contact = {
    doctorName: "Dr A",
    qualifications: "BHMS",
    registrationNo: "123",
    address: "Street",
    phone: "999",
    email: "d@x.com",
  };
  const valid = (by = "o@x.com") => ({
    displayName: "Grace",
    logoDataUrl: "",
    primaryColor: "#0f766e",
    showScripture: true,
    contact,
    updatedAt: 1,
    updatedBy: by,
  });

  it("members read their own clinic's branding, others cannot", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), path), valid());
    });
    await assertSucceeds(getDoc(doc(dbFor("a@x.com"), path)));
    await assertFails(getDoc(doc(dbFor("t@x.com"), path)));
  });

  it("owner writes valid branding; member cannot", async () => {
    await assertSucceeds(setDoc(doc(dbFor("o@x.com"), path), valid()));
    await assertFails(setDoc(doc(dbFor("a@x.com"), path), valid("a@x.com")));
  });

  it("owner accepts a small data-url logo", async () => {
    await assertSucceeds(
      setDoc(doc(dbFor("o@x.com"), path), {
        ...valid(),
        logoDataUrl: "data:image/png;base64,AAAA",
      }),
    );
  });

  it("accepts a logo of exactly 200000 chars", async () => {
    await assertSucceeds(
      setDoc(doc(dbFor("o@x.com"), path), {
        ...valid(),
        logoDataUrl: "data:image/webp;base64," + "A".repeat(200000 - 23),
      }),
    );
  });

  it("rejects invalid branding", async () => {
    const db = dbFor("o@x.com");
    const bad = (patch: Record<string, unknown>) =>
      assertFails(setDoc(doc(db, path), { ...valid(), ...patch }));
    await bad({ primaryColor: "blue" });
    await bad({ displayName: "x".repeat(61) });
    await bad({ logoDataUrl: "http://x/y.png" });
    await bad({ logoDataUrl: "data:image/png;base64," + "A".repeat(200001) });
    await bad({ foo: 1 });
    await bad({ updatedBy: "a@x.com" });
    await bad({ contact: { ...contact, phone: "9".repeat(121) } });
    await bad({ showScripture: "yes" });
  });

  it("superadmin writes valid branding", async () => {
    await assertSucceeds(setDoc(doc(dbFor(SUPER), path), valid(SUPER)));
  });

  it("owner cannot write other settings docs", async () => {
    await assertFails(
      setDoc(doc(dbFor("o@x.com"), "clinics/c1/settings/other"), valid()),
    );
  });
});

describe("staff, leaves and salary payments", () => {
  const paths = [
    "clinics/c1/staff/s1",
    "clinics/c1/leaves/l1",
    "clinics/c1/salaryPayments/s1_2026-02",
  ];
  const pay = (month: string) => ({
    staffId: "s1",
    month,
    needsReview: false,
    net: 1,
    paidOn: 1,
    adjustment: 0,
  });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "clinics/c1/staff/s1"), { name: "S" });
      await setDoc(doc(db, "clinics/c1/leaves/l1"), { staffId: "s1" });
      await setDoc(
        doc(db, "clinics/c1/salaryPayments/s1_2026-02"),
        pay("2026-02"),
      );
    });
  });

  it("the owner reads and writes all three", async () => {
    const db = dbFor("o@x.com");
    for (const p of paths) await assertSucceeds(getDoc(doc(db, p)));
    for (const c of ["staff", "leaves", "salaryPayments"]) {
      await assertSucceeds(getDocs(collection(db, `clinics/c1/${c}`)));
    }
    await assertSucceeds(setDoc(doc(db, "clinics/c1/staff/s2"), { name: "T" }));
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/leaves/l2"), { staffId: "s1" }),
    );
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/salaryPayments/s1_2026-03"), pay("2026-03")),
    );
    await assertSucceeds(
      deleteDoc(doc(db, "clinics/c1/salaryPayments/s1_2026-02")),
    );
  });

  it("a member is denied get, list and set on each", async () => {
    const db = dbFor("a@x.com");
    for (const p of paths) {
      await assertFails(getDoc(doc(db, p)));
      await assertFails(
        setDoc(doc(db, p.replace(/[^/]+$/, "new_2026-03")), pay("2026-03")),
      );
    }
    for (const c of ["staff", "leaves", "salaryPayments"]) {
      await assertFails(getDocs(collection(db, `clinics/c1/${c}`)));
    }
  });

  it("another clinic's owner is denied", async () => {
    const db = dbFor("t@x.com");
    for (const p of paths) {
      await assertFails(getDoc(doc(db, p)));
      await assertFails(setDoc(doc(db, p), pay("2026-02")));
    }
  });

  it("the superadmin reads and writes all three", async () => {
    const db = dbFor(SUPER);
    for (const p of paths) await assertSucceeds(getDoc(doc(db, p)));
    await assertSucceeds(setDoc(doc(db, "clinics/c1/staff/s2"), { name: "T" }));
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/leaves/l2"), { staffId: "s1" }),
    );
    await assertSucceeds(
      setDoc(doc(db, "clinics/c1/salaryPayments/s1_2026-03"), pay("2026-03")),
    );
  });

  it("denies a payment whose id or month is malformed", async () => {
    const db = dbFor("o@x.com");
    await assertFails(
      setDoc(doc(db, "clinics/c1/salaryPayments/s1_2026-04"), pay("2026-03")),
    );
    await assertFails(
      setDoc(doc(db, "clinics/c1/salaryPayments/s1_bad"), pay("bad")),
    );
    await assertFails(
      setDoc(doc(db, "clinics/c1/salaryPayments/s1_2026-13"), pay("2026-13")),
    );
  });

  it("denies a payment with non-integer net, paidOn or adjustment", async () => {
    const db = dbFor("o@x.com");
    const ref = doc(db, "clinics/c1/salaryPayments/s1_2026-03");
    await assertFails(setDoc(ref, { ...pay("2026-03"), net: "100" }));
    await assertFails(setDoc(ref, { ...pay("2026-03"), net: 100.5 }));
    await assertFails(setDoc(ref, { ...pay("2026-03"), paidOn: "x" }));
    await assertFails(setDoc(ref, { ...pay("2026-03"), adjustment: 1.5 }));
  });

  it("lets the owner flag a payment for review, not a member", async () => {
    const ref = "clinics/c1/salaryPayments/s1_2026-02";
    await assertSucceeds(
      updateDoc(doc(dbFor("o@x.com"), ref), { needsReview: true }),
    );
    await assertFails(
      updateDoc(doc(dbFor("a@x.com"), ref), { needsReview: true }),
    );
    await assertFails(
      updateDoc(doc(dbFor("o@x.com"), ref), { month: "2026-13" }),
    );
  });
});

describe("bookings", () => {
  const start = Date.now() + 86_400_000;
  const appt = (s: number, patch: Record<string, unknown> = {}) => ({
    date: s - (s % 86_400_000),
    start: s,
    end: s + 900_000,
    patientId: null,
    patientName: "Asha",
    phone: "9999999999",
    serialNo: null,
    status: "booked",
    note: "",
    createdBy: "a@x.com",
    createdAt: 1,
    consultationId: null,
    ...patch,
  });
  const apptPath = (s: number) => `clinics/c1/appointments/${s}`;
  const histPath = (s: number, c = 1) =>
    `clinics/c1/appointmentHistory/${s}_${c}`;
  const hist = (s: number, patch: Record<string, unknown> = {}) => ({
    ...appt(s, { status: "cancelled" }),
    closedAt: 5,
    closedBy: "a@x.com",
    ...patch,
  });
  const seed = () =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), apptPath(start)), appt(start));
    });

  it("lets members and the superadmin create valid appointments", async () => {
    await assertSucceeds(
      setDoc(doc(dbFor("a@x.com"), apptPath(start)), appt(start)),
    );
    const s2 = start + 3_600_000;
    await assertSucceeds(
      setDoc(doc(dbFor(SUPER), apptPath(s2)), appt(s2, { createdBy: SUPER })),
    );
  });

  it("denies bad ids, status, createdBy and past slots on create", async () => {
    const db = dbFor("a@x.com");
    await assertFails(setDoc(doc(db, apptPath(start + 1)), appt(start)));
    await assertFails(
      setDoc(doc(db, apptPath(start)), appt(start, { status: "done" })),
    );
    await assertFails(
      setDoc(doc(db, apptPath(start)), appt(start, { createdBy: "o@x.com" })),
    );
    const past = Date.now() - 7_200_000;
    await assertFails(setDoc(doc(db, apptPath(past)), appt(past)));
    const fut = start + 7_200_000;
    await assertSucceeds(setDoc(doc(db, apptPath(fut)), appt(fut)));
  });

  it("denies invalid appointment shapes", async () => {
    const db = dbFor("a@x.com");
    const r = doc(db, apptPath(start));
    await assertFails(setDoc(r, appt(start, { extra: 1 })));
    await assertFails(setDoc(r, appt(start, { patientName: "" })));
    await assertFails(setDoc(r, appt(start, { end: start })));
    await assertFails(setDoc(r, appt(start, { date: start + 1 })));
    await assertFails(setDoc(r, appt(start, { note: "x".repeat(201) })));
  });

  it("allows status updates but not slot or provenance changes", async () => {
    await seed();
    const ref = doc(dbFor("a@x.com"), apptPath(start));
    await assertSucceeds(updateDoc(ref, { status: "arrived" }));
    await assertFails(updateDoc(ref, { start: start + 1 }));
    await assertFails(updateDoc(ref, { date: start - 1 }));
    await assertFails(updateDoc(ref, { createdAt: 2 }));
    await assertFails(setDoc(ref, appt(start, { createdAt: 2 })));
  });

  it("closes an appointment only with its history in one batch", async () => {
    await seed();
    const db = dbFor("a@x.com");
    await assertFails(deleteDoc(doc(db, apptPath(start))));
    await assertFails(setDoc(doc(db, histPath(start)), hist(start)));
    const b = writeBatch(db);
    b.set(doc(db, histPath(start)), hist(start));
    b.delete(doc(db, apptPath(start)));
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(db, histPath(start)), { note: "x" }));
    await assertFails(deleteDoc(doc(db, histPath(start))));
    await assertSucceeds(getDoc(doc(db, histPath(start))));
  });

  it("denies invalid history docs", async () => {
    await seed();
    const db = dbFor("a@x.com");
    for (const patch of [
      { status: "done" },
      { extra: 1 },
      { closedBy: "o@x.com" },
    ]) {
      const b = writeBatch(db);
      b.set(doc(db, histPath(start)), hist(start, patch));
      b.delete(doc(db, apptPath(start)));
      await assertFails(b.commit());
    }
  });

  it("keeps bookings private to the clinic", async () => {
    await seed();
    const t = dbFor("t@x.com");
    const a = dbFor("a@x.com");
    await assertFails(getDoc(doc(t, apptPath(start))));
    await assertFails(getDoc(doc(t, histPath(start))));
    const s2 = start + 3_600_000;
    const s3 = start + 7_200_000;
    const own = (e: string) => appt(s2, { createdBy: e });
    const closed = (e: string) => hist(s3, { createdAt: 9, closedBy: e });
    await assertFails(setDoc(doc(t, apptPath(s2)), own("t@x.com")));
    await assertSucceeds(setDoc(doc(a, apptPath(s2)), own("a@x.com")));
    await assertFails(setDoc(doc(t, histPath(s3, 9)), closed("t@x.com")));
    await assertSucceeds(setDoc(doc(a, histPath(s3, 9)), closed("a@x.com")));
  });

  describe("schedule", () => {
    const sched = (patch: Record<string, unknown> = {}) => ({
      slotMinutes: 15,
      weekly: { mon: [{ start: "09:00", end: "13:00" }] },
      holidays: [],
      updatedAt: 1,
      updatedBy: "o@x.com",
      ...patch,
    });
    const path = "clinics/c1/settings/schedule";

    it("lets the owner write and members only read", async () => {
      await assertSucceeds(setDoc(doc(dbFor("o@x.com"), path), sched()));
      await assertFails(
        setDoc(doc(dbFor("a@x.com"), path), sched({ updatedBy: "a@x.com" })),
      );
      await assertSucceeds(getDoc(doc(dbFor("a@x.com"), path)));
    });

    it("denies invalid schedules", async () => {
      const r = doc(dbFor("o@x.com"), path);
      await assertFails(setDoc(r, sched({ slotMinutes: 3 })));
      await assertFails(setDoc(r, sched({ extra: 1 })));
      await assertFails(setDoc(r, sched({ weekly: { xyz: [] } })));
      const s = { start: "09:00", end: "10:00" };
      await assertFails(setDoc(r, sched({ weekly: { mon: [s, s, s, s] } })));
      await assertFails(setDoc(r, sched({ updatedBy: "x@x.com" })));
    });

    it("still denies unknown settings docs", async () => {
      await assertFails(
        setDoc(doc(dbFor("o@x.com"), "clinics/c1/settings/other"), sched()),
      );
    });
  });
});
