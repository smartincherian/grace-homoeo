import { describe, it, expect } from "vitest";
import { assertAccess } from "./access.js";
import type { Deps, Store } from "./deps.js";

function fake(docs: Record<string, Record<string, unknown>>): Deps {
  const m = new Map(Object.entries(docs));
  const store: Store = {
    get: async (p) => m.get(p) ?? null,
    set: async (p, d) => void m.set(p, d),
    delete: async (p) => void m.delete(p),
    query: async () => [],
    transaction: async (fn) => fn({ get: store.get, set: store.set }),
  };
  return {
    store,
    kms: { encrypt: async (s) => s, decrypt: async (s) => s },
    fetch: (() => Promise.reject(new Error("no fetch"))) as typeof fetch,
    now: () => 1_000,
  };
}
const auth = (email = "a@x.com", verified = true) => ({
  token: { email, email_verified: verified, name: "A" },
});
const base = () => ({
  "allowedEmails/a@x.com": { clinicId: "c1", seat: 2 },
  "clinics/c1": { ownerEmail: "o@x.com", name: "C1" },
});
const code = async (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe("assertAccess", () => {
  it("rejects unauthenticated", async () => {
    expect((await code(assertAccess(fake(base()), undefined, "c1", {}))).code).toBe("unauthenticated");
  });
  it("rejects unverified email", async () => {
    const e = await code(assertAccess(fake(base()), auth("a@x.com", false), "c1", {}));
    expect(e.code).toBe("permission-denied");
  });
  it('rejects malformed clinicId "../x"', async () => {
    expect((await code(assertAccess(fake(base()), auth(), "../x", {}))).code).toBe("invalid-argument");
  });
  it("rejects member of another clinic", async () => {
    const d = fake({ ...base(), "allowedEmails/a@x.com": { clinicId: "c2" }, "clinics/c2": {} });
    const e = await code(assertAccess(d, auth(), "c1", {}));
    expect(e.code).toBe("permission-denied");
    expect(e.message).toBe("You don't have access to this clinic.");
  });
  it("rejects inactive entry", async () => {
    const d = fake({ ...base(), "allowedEmails/a@x.com": { clinicId: "c1", active: false } });
    expect((await code(assertAccess(d, auth(), "c1", {}))).code).toBe("permission-denied");
  });
  it("rejects inactive clinic", async () => {
    const d = fake({ ...base(), "clinics/c1": { ownerEmail: "o@x.com", active: false } });
    expect((await code(assertAccess(d, auth(), "c1", {}))).code).toBe("permission-denied");
  });
  it("rejects missing clinic doc", async () => {
    const b = base();
    delete (b as Record<string, unknown>)["clinics/c1"];
    expect((await code(assertAccess(fake(b), auth(), "c1", {}))).code).toBe("permission-denied");
  });
  it("member passes without owner", async () => {
    const r = await assertAccess(fake(base()), auth("A@X.com"), "c1", {});
    expect(r.caller).toMatchObject({ email: "a@x.com", superadmin: false });
    expect(r.clinic).toMatchObject({ id: "c1", type: "homoeo", ownerEmail: "o@x.com" });
  });
  it("owner option rejects non-owner", async () => {
    const e = await code(assertAccess(fake(base()), auth(), "c1", { owner: true }));
    expect(e.code).toBe("permission-denied");
    expect(e.message).toBe("Only the clinic owner can change the AI key.");
  });
  it("owner option passes for the owner", async () => {
    const d = fake({ ...base(), "allowedEmails/o@x.com": { clinicId: "c1", seat: 1 } });
    await expect(assertAccess(d, auth("o@x.com"), "c1", { owner: true })).resolves.toBeTruthy();
  });
  it("write option rejects expired trial", async () => {
    const d = fake({ ...base(), "clinics/c1": { ownerEmail: "o@x.com", trialEndsAt: 500 } });
    const e = await code(assertAccess(d, auth(), "c1", { write: true }));
    expect(e.code).toBe("failed-precondition");
    expect(e.details).toEqual({ reason: "trial-ended" });
    expect(e.message).toBe("The clinic's trial has ended.");
  });
  it("write passes when authorized despite expired trial", async () => {
    const d = fake({ ...base(), "clinics/c1": { ownerEmail: "o@x.com", trialEndsAt: 500, authorized: true } });
    await expect(assertAccess(d, auth(), "c1", { write: true })).resolves.toBeTruthy();
  });
  it("write passes when trialEndsAt missing", async () => {
    await expect(assertAccess(fake(base()), auth(), "c1", { write: true })).resolves.toBeTruthy();
  });
  it("superadmin passes owner+write on any clinic with no allow-list entry", async () => {
    const d = fake({ "clinics/c9": { ownerEmail: "o@x.com", trialEndsAt: 500 } });
    const r = await assertAccess(d, auth("smartin.cherian@gmail.com"), "c9", { owner: true, write: true });
    expect(r.caller.superadmin).toBe(true);
  });
  it("general type read from clinic doc", async () => {
    const d = fake({ ...base(), "clinics/c1": { ownerEmail: "o@x.com", type: "general" } });
    expect((await assertAccess(d, auth(), "c1", {})).clinic.type).toBe("general");
  });
  it("unknown type -> homoeo", async () => {
    const d = fake({ ...base(), "clinics/c1": { ownerEmail: "o@x.com", type: "weird" } });
    expect((await assertAccess(d, auth(), "c1", {})).clinic.type).toBe("homoeo");
  });
});
