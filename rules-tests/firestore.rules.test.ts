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
