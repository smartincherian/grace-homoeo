// src/features/consultations/GeneralsLatest.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GeneralsLatest from "./GeneralsLatest";
import { EMPTY_GENERALS, type GeneralsRecord } from "./caseRecordSchema";
import { dateInputToMs } from "../../lib/dates";

const rec = (
  cid: string,
  day: string,
  over: Partial<GeneralsRecord>,
): GeneralsRecord => ({
  ...EMPTY_GENERALS,
  id: cid,
  patientId: "p1",
  consultationId: cid,
  date: dateInputToMs(day),
  updatedAt: 0,
  ...over,
});

const list = [
  rec("v2", "2026-10-19", { thirst: "Moderate" }),
  rec("v1", "2026-10-12", { thirst: "Large qty", bladder: "Normal" }),
];

describe("GeneralsLatest", () => {
  it("shows only each general's latest value, without dates", () => {
    render(<GeneralsLatest list={list} />);
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.queryByText("Large qty")).not.toBeInTheDocument();
    // A field last entered at an earlier visit still shows its latest value.
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.queryByText(/Oct 2026/)).not.toBeInTheDocument();
  });

  it("skips fields never recorded", () => {
    render(<GeneralsLatest list={list} />);
    expect(screen.queryByText("Appetite")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no history", () => {
    const { container } = render(<GeneralsLatest list={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
