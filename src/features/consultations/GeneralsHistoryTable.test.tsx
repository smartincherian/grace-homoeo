// src/features/consultations/GeneralsHistoryTable.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import GeneralsHistoryTable from "./GeneralsHistoryTable";
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

describe("GeneralsHistoryTable", () => {
  it("has one column per visit, newest first", () => {
    render(<GeneralsHistoryTable list={list} />);
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Field", "19 Oct 2026 · latest", "12 Oct 2026"]);
  });

  it("compares each general across visits", () => {
    render(<GeneralsHistoryTable list={list} />);
    const thirst = screen.getByText("Thirst").closest("tr")!;
    const cells = within(thirst)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells).toEqual(["Thirst", "Moderate", "Large qty"]);
    // Not entered at the latest visit: shown as a dash there.
    const bladder = screen.getByText("Bladder").closest("tr")!;
    const bladderCells = within(bladder)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(bladderCells).toEqual(["Bladder", "—", "Normal"]);
  });

  it("skips fields never recorded", () => {
    render(<GeneralsHistoryTable list={list} />);
    expect(screen.queryByText("Appetite")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no history", () => {
    const { container } = render(<GeneralsHistoryTable list={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
