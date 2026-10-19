// src/features/consultations/LsmcTable.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LsmcTable from "./LsmcTable";
import type { LsmcRow } from "./caseRecordSchema";

const rows: LsmcRow[] = [
  {
    id: "l1",
    patientId: "p1",
    consultationId: "c9",
    date: 946684800000,
    location: "Head",
    sensation: "Throbbing",
    modality: "",
    concomitant: "Nausea",
    createdAt: 1,
  },
];

describe("LsmcTable", () => {
  it("lists rows with the visit date when showDate", () => {
    render(<LsmcTable rows={rows} showDate />);
    expect(screen.getByText("Visit")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2000")).toBeInTheDocument();
    expect(screen.getByText("Throbbing")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("omits the visit column by default", () => {
    render(<LsmcTable rows={rows} />);
    expect(screen.queryByText("Visit")).not.toBeInTheDocument();
  });

  it("calls onSelect with the consultation id on row click", async () => {
    const onSelect = vi.fn();
    render(<LsmcTable rows={rows} onSelect={onSelect} />);
    await userEvent.setup().click(screen.getByText("Head"));
    expect(onSelect).toHaveBeenCalledWith("c9");
  });

  it("renders nothing for no rows", () => {
    const { container } = render(<LsmcTable rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
