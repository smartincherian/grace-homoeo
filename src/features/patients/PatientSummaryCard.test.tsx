import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import dayjs from "dayjs";

const st = vi.hoisted(() => ({
  configured: true,
  summary: null as null | Record<string, unknown>,
  pending: false,
  aiLoading: false,
  sumLoading: false,
  owner: false,
  expired: false,
  mutate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../lib/aiSummary", () => ({
  useAiStatus: () => ({
    data: st.aiLoading ? undefined : { configured: st.configured },
    isLoading: st.aiLoading,
  }),
  usePatientSummary: () => ({
    data: st.sumLoading ? undefined : st.summary,
    isLoading: st.sumLoading,
  }),
  useSummarizePatient: () => ({ mutate: st.mutate, isPending: st.pending }),
  aiErrorMessage: (e: Error) => `msg:${e.message}`,
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: st.toast }),
}));
vi.mock("../auth/AuthGuard", () => ({ useMembership: () => ({}) }));
vi.mock("../../lib/access", () => ({ canManageClinic: () => st.owner }));
vi.mock("../../lib/clinicQueries", () => ({
  useClinic: () => ({ data: { name: "C" } }),
}));
vi.mock("../../lib/subscription", () => ({
  clinicStatus: () => ({ kind: st.expired ? "expired" : "authorized" }),
}));

import PatientSummaryCard from "./PatientSummaryCard";

const GEN = new Date(2026, 9, 22, 10, 14).getTime();
const summary = (over = {}) => ({
  bullets: ["Fever on and off", "Responds to Bryonia"],
  generatedAt: GEN,
  generatedBy: "u",
  generatedByName: "Asha",
  model: "m",
  consultationCount: 2,
  lastConsultationAt: 1000,
  ...over,
});

function renderCard(latestVisitAt: number | null = null) {
  render(
    <MemoryRouter initialEntries={["/c1/patients/p1"]}>
      <Routes>
        <Route
          path="/:clinicSlug/patients/:id"
          element={
            <PatientSummaryCard patientId="p1" latestVisitAt={latestVisitAt} />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.assign(st, {
    configured: true,
    summary: null,
    pending: false,
    aiLoading: false,
    sumLoading: false,
    owner: false,
    expired: false,
  });
  st.mutate.mockReset();
  st.toast.mockReset();
});

describe("PatientSummaryCard", () => {
  it("explains when no key is set, with a Settings link for the owner", () => {
    st.configured = false;
    st.owner = true;
    renderCard();
    expect(screen.getByText(/AI summary is off/).textContent).toBe(
      "AI summary is off. The clinic owner can add a Gemini key in Settings.",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/c1/settings",
    );
  });

  it("has no Settings link for a non-owner", () => {
    st.configured = false;
    renderCard();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("shows Summarize when a key is set and no summary exists", async () => {
    renderCard();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Summarize" }));
    expect(st.mutate).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("renders the summary as a list with meta, caption and Re-run", () => {
    st.summary = summary();
    renderCard();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText(
        `Generated ${dayjs(GEN).format("D MMM YYYY, HH:mm")} by Asha`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Generated 22 Oct 2026, 10:14 by Asha"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "AI-generated from the record. Check before relying on it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-run" })).toBeEnabled();
  });

  it("hints at new visits only when the latest visit is newer", () => {
    st.summary = summary({ lastConsultationAt: 1000 });
    renderCard(2000);
    expect(
      screen.getByText(/New visits since this summary/),
    ).toBeInTheDocument();
  });

  it.each([1000, null])("no stale hint when latestVisitAt is %s", (v) => {
    st.summary = summary({ lastConsultationAt: 1000 });
    renderCard(v);
    expect(screen.queryByText(/New visits since this summary/)).toBeNull();
  });

  it("disables the button while pending", () => {
    st.pending = true;
    renderCard();
    expect(screen.getByRole("button", { name: /Summarize/ })).toBeDisabled();
  });

  it("toasts the error message on failure", async () => {
    st.mutate.mockImplementation((_v, o) => o.onError(new Error("boom")));
    renderCard();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Summarize" }));
    expect(st.toast).toHaveBeenCalledWith("msg:boom", "error");
  });

  it("keeps the summary but disables Re-run when the trial expired", () => {
    st.summary = summary();
    st.expired = true;
    renderCard();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Re-run" })).toBeDisabled();
  });

  it("shows the summary without Re-run if the key was removed", () => {
    st.summary = summary();
    st.configured = false;
    renderCard();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Re-run" })).toBeNull();
    expect(screen.getByText(/AI summary is off/)).toBeInTheDocument();
  });

  it("shows neither the no-key text nor a button while the AI status loads", () => {
    st.aiLoading = true;
    st.configured = false;
    renderCard();
    expect(screen.queryByText(/AI summary is off/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no Summarize button while the summary loads", () => {
    st.sumLoading = true;
    renderCard();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/AI summary is off/)).toBeNull();
  });
});
