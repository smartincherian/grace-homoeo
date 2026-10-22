import { describe, expect, it } from "vitest";
import {
  MAX_CHARS,
  buildCaseRecord,
  featuresFor,
  redactName,
  systemInstruction,
  type CaseInput,
} from "./caseRecord.js";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 22, 6, 0, 0);

function base(over: Partial<CaseInput> = {}): CaseInput {
  return {
    type: "homoeo",
    patient: { name: "Ravi Kumar", dob: null, gender: "M" },
    consultations: [],
    generals: null,
    lsmc: [],
    now: NOW,
    ...over,
  };
}

const visit = (i: number, extra: Record<string, unknown> = {}) => ({
  date: NOW - (i + 1) * DAY * 3,
  complaint: `complaint-${i}`,
  ...extra,
});

describe("featuresFor", () => {
  it("maps clinic types to flags", () => {
    expect(featuresFor("homoeo")).toEqual({ lsmc: true, differentialRemedy: true, homoeoGenerals: true });
    expect(featuresFor("general")).toEqual({ lsmc: false, differentialRemedy: false, homoeoGenerals: false });
  });
});

describe("redactName", () => {
  it("redacts name words whole-word, case-insensitive", () => {
    expect(redactName("ravi has fever; Ravi Kumar better", "Ravi Kumar")).toBe(
      "the patient has fever; the patient better",
    );
  });
  it("handles hyphenated, accented, apostrophe and Malayalam names", () => {
    expect(redactName("Mary complains; mary-ann ok", "Mary-Ann Thomas")).toBe(
      "the patient complains; the patient ok",
    );
    expect(redactName("zoë has fever", "Zoë")).toBe("the patient has fever");
    expect(redactName("D'Souza is better", "D'Souza")).toBe("the patient is better");
    expect(redactName("അനു ക്ക് പനി", "അനു")).toBe("the patient ക്ക് പനി");
  });
  it("does not redact inside other words or short words", () => {
    expect(redactName("continuous pain", "Anu")).toBe("continuous pain");
    expect(redactName("Al is ok", "Al B")).toBe("Al is ok");
  });
});

describe("buildCaseRecord", () => {
  it("never includes excluded fields", () => {
    const r = buildCaseRecord(
      base({
        patient: { name: "Ravi Kumar", dob: Date.UTC(1990, 0, 5), gender: "M", phone: "98400", email: "ravi@example.com", place: "Kochi", serialNo: 77 } as never,
        consultations: [
          { date: Date.UTC(2026, 2, 3), complaint: "Ravi has cough", amount: 500, paymentMode: "UPI", patientName: "Ravi Kumar", serialNo: 77, createdBy: "doc@clinic.com", id: "cons-abc", patientId: "pat-xyz" } as never,
        ],
      }),
    );
    for (const s of ["98400", "Kochi", "77", "500", "UPI", "Ravi", "Kumar", "doc@clinic.com", "cons-abc", "pat-xyz", "ravi@example.com", "createdBy"]) {
      expect(r.text).not.toContain(s);
    }
    expect(r.text).toContain("the patient has cough");
  });

  it("computes age in Asia/Kolkata and gender", () => {
    const r = buildCaseRecord(base({ patient: { name: "X Y", dob: Date.UTC(1992, 0, 5), gender: "F" } }));
    expect(r.text).toContain("Age: 34 years");
    expect(r.text).toContain("Gender: F");
  });

  it("newest first and capped at 30 visits", () => {
    const consultations = Array.from({ length: 35 }, (_, i) => visit(i));
    const r = buildCaseRecord(base({ consultations }));
    expect(r.consultationCount).toBe(35);
    expect(r.text.match(/^### /gm)).toHaveLength(30);
    expect(r.text).toContain("complaint-0");
    expect(r.text).not.toContain("complaint-34");
    expect(r.text.indexOf("complaint-0")).toBeLessThan(r.text.indexOf("complaint-1\n"));
  });

  it("drops oldest visits until under MAX_CHARS", () => {
    const consultations = Array.from({ length: 20 }, (_, i) => visit(i, { remarks: "x".repeat(5000) }));
    const r = buildCaseRecord(base({ consultations }));
    expect(r.text.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(r.text).toContain("complaint-0");
    expect(r.text).not.toContain("complaint-19");
  });

  it("general clinic omits LSMC, differentialRemedy, mentals, perspiration", () => {
    const input = base({
      type: "general",
      consultations: [visit(0, { differentialRemedy: "Sulph", remedy: "Tab PCM" })],
      generals: { mentals: "anxious", perspirationOdour: "foul", sleepDreams: "poor", appetite: "good" },
      lsmc: [{ location: "head", sensation: "throbbing", modality: "worse sun", concomitant: "nausea" }],
    });
    const t = buildCaseRecord(input).text;
    expect(t).not.toContain("Sulph");
    expect(t).not.toContain("anxious");
    expect(t).not.toContain("foul");
    expect(t).not.toContain("throbbing");
    expect(t).not.toContain("## LSMC");
    expect(t).toContain("poor");
    expect(t).toContain("Prescription: Tab PCM");
  });

  it("homoeo clinic includes LSMC rows (cap 50) and mentals", () => {
    const lsmc = Array.from({ length: 60 }, (_, i) => ({ location: `loc-${i}`, sensation: "s", modality: "", concomitant: "" }));
    const t = buildCaseRecord(
      base({ lsmc, generals: { mentals: "anxious", perspirationOdour: "foul" }, consultations: [visit(0, { differentialRemedy: "Sulph" })] }),
    ).text;
    expect(t).toContain("anxious");
    expect(t).toContain("foul");
    expect(t).toContain("Sulph");
    expect(t).toContain("loc-49");
    expect(t).not.toContain("loc-50");
  });

  it("thin record", () => {
    const r = buildCaseRecord(base());
    expect(r.text).toContain("Age: unknown");
    expect(r.text).toContain("No consultations recorded");
    expect(r.lastConsultationAt).toBeNull();
    expect(r.consultationCount).toBe(0);
  });

  it("lastConsultationAt is the max createdAt ?? date", () => {
    const r = buildCaseRecord(
      base({ consultations: [{ date: 1000 }, { date: 2000, createdAt: 9000 }, { date: 5000 }] }),
    );
    expect(r.lastConsultationAt).toBe(9000);
  });
});

describe("systemInstruction", () => {
  it("is type specific", () => {
    expect(systemInstruction("general")).not.toContain("modalities");
    expect(systemInstruction("homoeo")).toContain("peculiar");
  });
});
