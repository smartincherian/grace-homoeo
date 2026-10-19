// src/features/consultations/GeneralsView.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import GeneralsView from "./GeneralsView";
import { EMPTY_GENERALS } from "./caseRecordSchema";
import { dateInputToMs } from "../../lib/dates";

describe("GeneralsView", () => {
  it("shows only filled generals, grouped", () => {
    render(
      <GeneralsView
        generals={{
          ...EMPTY_GENERALS,
          thirst: "thirstless",
          perspirationOdour: "offensive",
        }}
      />,
    );
    expect(screen.getByText("Thirst")).toBeInTheDocument();
    expect(screen.getByText("thirstless")).toBeInTheDocument();
    expect(screen.getByText("Perspiration")).toBeInTheDocument();
    expect(screen.getByText("Odour")).toBeInTheDocument();
    expect(screen.queryByText("Appetite")).not.toBeInTheDocument();
    expect(screen.queryByText("Menstrual")).not.toBeInTheDocument();
  });

  it("formats LMP as a date", () => {
    render(
      <GeneralsView
        generals={{ ...EMPTY_GENERALS, lmp: dateInputToMs("2026-10-01") }}
      />,
    );
    expect(screen.getByText("LMP")).toBeInTheDocument();
    expect(screen.getByText("1 Oct 2026")).toBeInTheDocument();
  });

  it("renders nothing when blank", () => {
    const { container } = render(<GeneralsView generals={EMPTY_GENERALS} />);
    expect(container).toBeEmptyDOMElement();
  });
});
