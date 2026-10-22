import { describe, it, expect } from "vitest";
import { checkAndCount, HOUR_LIMIT, DAY_LIMIT } from "./rateLimit.js";
import type { Store } from "./deps.js";

function fake() {
  const m = new Map<string, Record<string, unknown>>();
  const store: Store = {
    get: async (p) => m.get(p) ?? null,
    set: async (p, d) => void m.set(p, d),
    delete: async (p) => void m.delete(p),
    query: async () => [],
    transaction: async (fn) => fn({ get: store.get, set: store.set }),
  };
  return { store, m };
}
const H = 3_600_000;
const D = 86_400_000;
const err = (p: Promise<unknown>) => p.then(() => null, (e) => e);

describe("checkAndCount", () => {
  it("allows first call and writes counts 1/1", async () => {
    const { store, m } = fake();
    await checkAndCount(store, "c1", "p1", 5 * H + 10);
    expect(m.get("aiUsage/c1")).toMatchObject({ hourCount: 1, dayCount: 1, hourKey: 5, dayKey: 0, lastByPatient: { p1: 5 * H + 10 } });
  });
  it("31st call in the same hour is resource-exhausted", async () => {
    const { store } = fake();
    for (let i = 0; i < HOUR_LIMIT; i++) await checkAndCount(store, "c1", `p${i}`, 5 * H + 100);
    const e = await err(checkAndCount(store, "c1", "pz", 5 * H + 100));
    expect(e.code).toBe("resource-exhausted");
    expect(e.message).toMatch(/^Summary limit reached, try again in \d+ minutes\.$/);
  });
  it("resets in the next hour", async () => {
    const { store, m } = fake();
    for (let i = 0; i < HOUR_LIMIT; i++) await checkAndCount(store, "c1", `p${i}`, 5 * H);
    await checkAndCount(store, "c1", "pz", 6 * H);
    expect(m.get("aiUsage/c1")).toMatchObject({ hourKey: 6, hourCount: 1, dayCount: HOUR_LIMIT + 1 });
  });
  it("201st in a day is rejected even across hours", async () => {
    const { store } = fake();
    for (let i = 0; i < DAY_LIMIT; i++) await checkAndCount(store, "c1", `p${i}`, Math.floor(i / 25) * H);
    const e = await err(checkAndCount(store, "c1", "pz", 8 * H));
    expect(e.code).toBe("resource-exhausted");
    expect(e.message).toMatch(/try again in \d+ minutes/);
  });
  it("same patient within 20 s is rejected", async () => {
    const { store } = fake();
    await checkAndCount(store, "c1", "p1", H);
    const e = await err(checkAndCount(store, "c1", "p1", H + 19_000));
    expect(e.code).toBe("resource-exhausted");
    expect(e.message).toBe("A summary was just requested, wait a moment.");
  });
  it("same patient after 20 s is ok", async () => {
    const { store } = fake();
    await checkAndCount(store, "c1", "p1", H);
    await checkAndCount(store, "c1", "p1", H + 20_000);
  });
  it("different patient immediately is ok", async () => {
    const { store } = fake();
    await checkAndCount(store, "c1", "p1", H);
    await checkAndCount(store, "c1", "p2", H + 1);
  });
  it("prunes lastByPatient entries older than 1 h", async () => {
    const { store, m } = fake();
    await checkAndCount(store, "c1", "old", H);
    await checkAndCount(store, "c1", "new", 2 * H + 1);
    expect(Object.keys((m.get("aiUsage/c1") as any).lastByPatient)).toEqual(["new"]);
  });
});
