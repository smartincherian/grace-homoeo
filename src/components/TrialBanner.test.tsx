import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

const useClinic = vi.hoisted(() => vi.fn());
vi.mock("../lib/clinicQueries", () => ({
  useClinic: (id: string) => useClinic(id),
}));
vi.mock("../lib/useBranding", () => ({
  useBranding: () => ({ data: undefined }),
}));
const membership = vi.hoisted(() => ({
  value: { superadmin: false, clinicId: "c1", owner: true },
}));
vi.mock("../features/auth/AuthGuard", () => ({
  useMembership: () => membership.value,
}));

import TrialBanner from "./TrialBanner";
import { notifyWriteDenied } from "../lib/writeDenied";

const DAY = 86_400_000;
const clinic = (extra: object) => ({
  data: { id: "c1", name: "Grace", ownerEmail: "o@x.com", ...extra },
});

beforeEach(() => {
  membership.value = { superadmin: false, clinicId: "c1", owner: true };
});

describe("TrialBanner", () => {
  it("shows days left with a WhatsApp link", () => {
    useClinic.mockReturnValue(
      clinic({ trialEndsAt: Date.now() + 3 * DAY - 1000 }),
    );
    render(<TrialBanner clinicId="c1" />);
    expect(screen.getByText(/Free trial · 3 days left/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Subscribe" }).getAttribute("href"),
    ).toMatch(/^https:\/\/wa\.me\/919036209639/);
  });

  it("stays hidden until fewer than 8 days are left", () => {
    useClinic.mockReturnValue(
      clinic({ trialEndsAt: Date.now() + 8 * DAY - 1000 }),
    );
    const { container, unmount } = render(<TrialBanner clinicId="c1" />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    useClinic.mockReturnValue(
      clinic({ trialEndsAt: Date.now() + 7 * DAY - 1000 }),
    );
    render(<TrialBanner clinicId="c1" />);
    expect(screen.getByText(/Free trial · 7 days left/)).toBeInTheDocument();
  });

  it("uses the singular for the last day", () => {
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() + 3_600_000 }));
    render(<TrialBanner clinicId="c1" />);
    expect(screen.getByText(/1 day left/)).toBeInTheDocument();
  });

  it("when expired shows the bar and opens the dialog on a denied write", async () => {
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() - 1000 }));
    render(<TrialBanner clinicId="c1" />);
    expect(screen.getByText(/Your free trial has ended/)).toBeInTheDocument();
    expect(screen.queryByText("Trial ended")).not.toBeInTheDocument();
    act(() => notifyWriteDenied());
    expect(await screen.findByText("Trial ended")).toBeInTheDocument();
  });

  it.each([
    ["authorized", { authorized: true, trialEndsAt: Date.now() - 1000 }],
    ["legacy", {}],
  ])("renders nothing for %s", (_n, extra) => {
    useClinic.mockReturnValue(clinic(extra));
    const { container } = render(<TrialBanner clinicId="c1" />);
    act(() => notifyWriteDenied());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Trial ended")).not.toBeInTheDocument();
  });

  it("renders nothing for the superadmin", () => {
    membership.value = { superadmin: true, clinicId: "c1", owner: false };
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() - 1000 }));
    const { container } = render(<TrialBanner clinicId="c1" />);
    act(() => notifyWriteDenied());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while loading", () => {
    useClinic.mockReturnValue({ data: undefined });
    const { container } = render(<TrialBanner clinicId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("drops the banner once the clinic becomes authorized", () => {
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() - 1000 }));
    const { container, rerender } = render(<TrialBanner clinicId="c1" />);
    expect(screen.getByText(/Your free trial has ended/)).toBeInTheDocument();
    useClinic.mockReturnValue(
      clinic({ trialEndsAt: Date.now() - 1000, authorized: true }),
    );
    rerender(<TrialBanner clinicId="c1" />);
    act(() => notifyWriteDenied());
    expect(container).toBeEmptyDOMElement();
  });

  it("uses readable warning text in the last five days", () => {
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() + 2 * DAY }));
    render(<TrialBanner clinicId="c1" />);
    expect(getComputedStyle(screen.getByRole("status")).color).toBe(
      "rgb(138, 83, 0)",
    );
  });

  it("uses readable danger text when expired", () => {
    useClinic.mockReturnValue(clinic({ trialEndsAt: Date.now() - 1000 }));
    render(<TrialBanner clinicId="c1" />);
    expect(getComputedStyle(screen.getByRole("status")).color).toBe(
      "rgb(168, 36, 60)",
    );
  });
});
