import { describe, expect, it } from "vitest";
import {
  TRIAL_MS,
  clinicStatus,
  pricingWhatsAppUrl,
  trialOk,
} from "./subscription";

describe("clinicStatus", () => {
  it("authorized wins over any trial end", () => {
    expect(clinicStatus({ authorized: true, trialEndsAt: 0 }, 5)).toEqual({
      kind: "authorized",
    });
  });
  it("is legacy without trialEndsAt", () => {
    expect(clinicStatus({}, 5)).toEqual({ kind: "legacy" });
  });
  it("counts whole days left, rounding up", () => {
    expect(clinicStatus({ trialEndsAt: 1000 + TRIAL_MS }, 1000)).toEqual({
      kind: "trial",
      daysLeft: 21,
    });
    expect(clinicStatus({ trialEndsAt: 1000 }, 999)).toEqual({
      kind: "trial",
      daysLeft: 1,
    });
  });
  it("is expired at and after trialEndsAt", () => {
    expect(clinicStatus({ trialEndsAt: 1000 }, 1000)).toEqual({
      kind: "expired",
    });
  });
});

describe("trialOk", () => {
  it("is false only when expired", () => {
    expect(trialOk({ kind: "expired" })).toBe(false);
    expect(trialOk({ kind: "legacy" })).toBe(true);
    expect(trialOk({ kind: "authorized" })).toBe(true);
    expect(trialOk({ kind: "trial", daysLeft: 3 })).toBe(true);
  });
});

describe("pricingWhatsAppUrl", () => {
  it("builds the pre-filled wa.me link", () => {
    expect(
      pricingWhatsAppUrl({
        clinicName: "Sun Clinic",
        clinicId: "sun",
        email: "a@b.com",
      }),
    ).toBe(
      "https://wa.me/919036209639?text=" +
        encodeURIComponent(
          "Hi, I'd like to know the Grace Medica subscription pricing. Clinic: Sun Clinic (sun), email: a@b.com.",
        ),
    );
  });
});
