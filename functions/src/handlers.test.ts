import { describe, it, expect } from "vitest";
import { saveAiKey, removeAiKey, summarizePatient, cleanupClinic } from "./handlers.js";
import type { Deps, Store } from "./deps.js";

const KEY = "AIzaSyDUMMYKEY1234567890abcd";
const OK_BULLETS = { bullets: ["one", "two", "three"] };

function make(docs: Record<string, Record<string, unknown>> = {}, opts: { geminiStatus?: number } = {}) {
  const m = new Map(Object.entries(docs));
  const store: Store = {
    get: async (p) => m.get(p) ?? null,
    set: async (p, d) => void m.set(p, d),
    delete: async (p) => void m.delete(p),
    query: async (col, field, value) =>
      [...m.entries()]
        .filter(([p, d]) => p.startsWith(col + "/") && !p.slice(col.length + 1).includes("/") && d[field] === value)
        .map(([, d]) => d),
    transaction: async (fn) => fn({ get: store.get, set: store.set }),
  };
  const bodies: string[] = [];
  const fetchFn = (async (_url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(String(init.body));
    const status = opts.geminiStatus ?? 200;
    if (status !== 200) return new Response("{}", { status });
    if (init?.method === "GET") return new Response("{}", { status: 200 });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(OK_BULLETS) }] } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const deps: Deps = {
    store,
    kms: {
      encrypt: async (p, aad) => `enc:${aad}:${p}`,
      decrypt: async (c, aad) => {
        const pre = `enc:${aad}:`;
        if (!c.startsWith(pre)) throw new Error("aad mismatch");
        return c.slice(pre.length);
      },
    },
    fetch: fetchFn,
    now: () => 1_000_000_000_000,
  };
  return { deps, m, bodies };
}
const auth = (email: string, name?: string) => ({ token: { email, email_verified: true, name } });
const owner = auth("o@x.com", "Dr O");
const member = auth("a@x.com");
const base = (): Record<string, Record<string, unknown>> => ({
  "allowedEmails/o@x.com": { clinicId: "c1", seat: 1 },
  "allowedEmails/a@x.com": { clinicId: "c1", seat: 2 },
  "clinics/c1": { ownerEmail: "o@x.com", type: "homoeo" },
  "clinics/c1/patients/p1": { name: "Jane Roe", dob: null, gender: "F", phone: "9876543210" },
  "clinics/c1/consultations/k1": {
    patientId: "p1", patientName: "Jane Roe", serialNo: 7, date: 900_000_000_000, createdAt: 900_000_000_000,
    complaint: "cough", phone: "9876543210", amount: 500, paymentMode: "cash",
  },
});
const withSecret = (extra = {}) => ({
  ...base(),
  "aiSecrets/c1": { provider: "gemini", ciphertext: `enc:c1:${KEY}`, updatedAt: 1, updatedBy: "o@x.com" },
  ...extra,
});
const err = (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe("saveAiKey", () => {
  it("stores ciphertext and status, returns no key", async () => {
    const { deps, m } = make(base());
    const res = await saveAiKey(deps, owner, { clinicId: "c1", apiKey: ` ${KEY} ` });
    const secret = m.get("aiSecrets/c1")!;
    expect(secret.ciphertext).not.toBe(KEY);
    expect(secret).toMatchObject({ provider: "gemini", updatedBy: "o@x.com" });
    const status = m.get("clinics/c1/settings/ai")!;
    expect(status).toMatchObject({ provider: "gemini", configured: true, last4: KEY.slice(-4), updatedBy: "o@x.com" });
    expect(JSON.stringify(res)).not.toContain(KEY);
    expect(JSON.stringify(status)).not.toContain(KEY);
  });
  it("replaces an existing key", async () => {
    const { deps, m } = make(withSecret());
    const k2 = "AIzaSyOTHERKEY0987654321wxyz";
    await saveAiKey(deps, owner, { clinicId: "c1", apiKey: k2 });
    expect(m.get("aiSecrets/c1")!.ciphertext).toBe(`enc:c1:${k2}`);
    expect(m.get("clinics/c1/settings/ai")!.last4).toBe("wxyz");
  });
  it("rejects member (not owner)", async () => {
    const { deps, m } = make(base());
    const e = await err(saveAiKey(deps, member, { clinicId: "c1", apiKey: KEY }));
    expect(e.code).toBe("permission-denied");
    expect(m.has("aiSecrets/c1")).toBe(false);
  });
  it("rejects whitespace and short keys", async () => {
    const { deps } = make(base());
    for (const apiKey of ["AIzaSy DUMMY KEY 1234567890abcd", "short", 5 as unknown as string]) {
      const e = await err(saveAiKey(deps, owner, { clinicId: "c1", apiKey }));
      expect(e.code).toBe("invalid-argument");
      expect(e.message).toBe("That doesn't look like a Gemini API key.");
    }
  });
  it("rejects a key Gemini refuses, writes nothing", async () => {
    const { deps, m } = make(base(), { geminiStatus: 403 });
    const e = await err(saveAiKey(deps, owner, { clinicId: "c1", apiKey: KEY }));
    expect(e.code).toBe("failed-precondition");
    expect(e.message).toBe("That key was rejected by Gemini.");
    expect(m.has("aiSecrets/c1")).toBe(false);
    expect(m.has("clinics/c1/settings/ai")).toBe(false);
  });
  it("blocks save when the trial has ended", async () => {
    const d = base();
    d["clinics/c1"] = { ownerEmail: "o@x.com", trialEndsAt: 5 };
    const { deps } = make(d);
    const e = await err(saveAiKey(deps, owner, { clinicId: "c1", apiKey: KEY }));
    expect(e.details).toEqual({ reason: "trial-ended" });
  });
});

describe("removeAiKey", () => {
  it("works after the trial ended and deletes the secret", async () => {
    const d = withSecret();
    d["clinics/c1"] = { ownerEmail: "o@x.com", trialEndsAt: 5 };
    const { deps, m } = make(d);
    const res = await removeAiKey(deps, owner, { clinicId: "c1" });
    expect(m.has("aiSecrets/c1")).toBe(false);
    expect(res.configured).toBe(false);
    expect(m.get("clinics/c1/settings/ai")).toMatchObject({ configured: false, last4: "" });
  });
  it("rejects a member", async () => {
    const { deps } = make(withSecret());
    expect((await err(removeAiKey(deps, member, { clinicId: "c1" }))).code).toBe("permission-denied");
  });
});

describe("summarizePatient", () => {
  it("writes the summary doc with counts", async () => {
    const { deps, m } = make(withSecret());
    const res = await summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" });
    expect(res).toMatchObject({
      bullets: OK_BULLETS.bullets, generatedAt: 1_000_000_000_000, generatedBy: "a@x.com",
      generatedByName: "a@x.com", consultationCount: 1, lastConsultationAt: 900_000_000_000,
    });
    expect(m.get("clinics/c1/patientSummaries/p1")).toEqual(res);
  });
  it("uses the token name when present", async () => {
    const { deps } = make(withSecret());
    const res = await summarizePatient(deps, owner, { clinicId: "c1", patientId: "p1" });
    expect(res.generatedByName).toBe("Dr O");
  });
  it("no key -> failed-precondition no-key", async () => {
    const { deps } = make(base());
    const e = await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" }));
    expect(e.code).toBe("failed-precondition");
    expect(e.details).toEqual({ reason: "no-key" });
    expect(e.message).toBe("AI summary is off. Ask the owner to add a Gemini key in Settings.");
  });
  it("missing patient -> not-found", async () => {
    const { deps } = make(withSecret());
    const e = await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "nope" }));
    expect(e.code).toBe("not-found");
    expect(e.message).toBe("Patient not found.");
  });
  it("bad patientId -> invalid-argument", async () => {
    const { deps } = make(withSecret());
    expect((await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "a/b" }))).code).toBe("invalid-argument");
  });
  it("trial ended -> trial-ended", async () => {
    const d = withSecret();
    d["clinics/c1"] = { ownerEmail: "o@x.com", trialEndsAt: 5 };
    const { deps } = make(d);
    const e = await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" }));
    expect(e.details).toEqual({ reason: "trial-ended" });
  });
  it("Gemini failure writes nothing and keeps the previous summary", async () => {
    const prev = { bullets: ["old"], generatedAt: 1 };
    const { deps, m } = make(withSecret({ "clinics/c1/patientSummaries/p1": prev }), { geminiStatus: 429 });
    const e = await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" }));
    expect(e.code).toBe("resource-exhausted");
    expect(m.get("clinics/c1/patientSummaries/p1")).toEqual(prev);
  });
  it("decrypts with the clinic's own AAD (copied secret fails as internal)", async () => {
    const { deps, m } = make(withSecret({ "aiSecrets/c1": { provider: "gemini", ciphertext: `enc:c2:${KEY}` } }));
    const e = await err(summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" }));
    expect(e.code).toBe("internal");
    expect(e.message).toBe("The summary couldn't be generated, try again.");
    expect(m.has("clinics/c1/patientSummaries/p1")).toBe(false);
  });
  it("prompt sent to Gemini excludes phone and name", async () => {
    const { deps, bodies } = make(withSecret());
    await summarizePatient(deps, member, { clinicId: "c1", patientId: "p1" });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain("cough");
    for (const s of ["9876543210", "Jane", "Roe", "p1", "k1", "o@x.com", "a@x.com"]) expect(bodies[0]).not.toContain(s);
  });
});

describe("cleanupClinic", () => {
  it("deletes aiSecrets and aiUsage", async () => {
    const { deps, m } = make({ "aiSecrets/c1": { a: 1 }, "aiUsage/c1": { b: 1 }, "aiSecrets/c2": { a: 1 } });
    await cleanupClinic(deps, "c1");
    expect([...m.keys()]).toEqual(["aiSecrets/c2"]);
  });
});
