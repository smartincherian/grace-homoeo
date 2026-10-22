import { vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AiStatus } from "../../lib/aiSummary";

const status = vi.hoisted(() => ({ value: undefined as unknown }));
const saveMutate = vi.hoisted(() => vi.fn());
const removeMutate = vi.hoisted(() => vi.fn());
const savePending = vi.hoisted(() => ({ value: false }));
const showToast = vi.hoisted(() => vi.fn());

vi.mock("../../lib/aiSummary", () => ({
  useAiStatus: () => ({ data: status.value, isLoading: false, isError: false }),
  useSaveAiKey: () => ({ mutate: saveMutate, isPending: savePending.value }),
  useRemoveAiKey: () => ({ mutate: removeMutate, isPending: false }),
  aiErrorMessage: (e: Error) => `msg:${e.message}`,
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import AiSummarySection from "./AiSummarySection";

const none: AiStatus = {
  provider: "gemini",
  configured: false,
  last4: "",
  model: "",
  updatedAt: 0,
  updatedBy: "",
};
const set: AiStatus = {
  ...none,
  configured: true,
  last4: "a1b2",
  updatedAt: 1760000000000,
};

beforeEach(() => {
  status.value = none;
  savePending.value = false;
  saveMutate.mockReset();
  removeMutate.mockReset();
  showToast.mockReset();
});

const field = () => screen.getByLabelText("Gemini API key") as HTMLInputElement;

describe("AiSummarySection", () => {
  it("not configured: shows password field and Save key button", () => {
    render(<AiSummarySection clinicId="c1" />);
    expect(field().type).toBe("password");
    expect(field().getAttribute("autocomplete")).toBe("off");
    expect(screen.getByRole("button", { name: "Save key" })).toBeTruthy();
  });

  it("Save key calls mutate with trimmed value, clears field on success, toasts", async () => {
    saveMutate.mockImplementation((_k, o) => o.onSuccess());
    render(<AiSummarySection clinicId="c1" />);
    await userEvent.type(field(), "  abc123  ");
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(saveMutate.mock.calls[0][0]).toBe("abc123");
    expect(showToast).toHaveBeenCalledWith("Gemini key saved", "success");
    await waitFor(() => expect(field().value).toBe(""));
  });

  it("Save disabled while empty or pending", async () => {
    const { rerender } = render(<AiSummarySection clinicId="c1" />);
    const btn = screen.getByRole("button", { name: "Save key" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(field(), "k");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    savePending.value = true;
    rerender(<AiSummarySection clinicId="c1" />);
    expect(
      (screen.getByRole("button", { name: "Save key" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("configured: shows last4 and Replace/Remove, no input", () => {
    status.value = set;
    render(<AiSummarySection clinicId="c1" />);
    expect(screen.getByText(/ends in …a1b2/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(screen.queryByLabelText("Gemini API key")).toBeNull();
  });

  it("Replace reveals the field; Cancel hides it", async () => {
    status.value = set;
    render(<AiSummarySection clinicId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    await userEvent.type(field(), "zzz");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Gemini API key")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(field().value).toBe("");
  });

  it("Remove asks to confirm, then removes and toasts", async () => {
    status.value = set;
    removeMutate.mockImplementation((_v, o) => o.onSuccess());
    render(<AiSummarySection clinicId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(removeMutate).not.toHaveBeenCalled();
    const dlg = screen.getByRole("dialog");
    await userEvent.click(within(dlg).getByRole("button", { name: "Remove" }));
    expect(removeMutate).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("Gemini key removed", "success");
  });

  it("save error toasts aiErrorMessage and keeps the value", async () => {
    saveMutate.mockImplementation((_k, o) => o.onError(new Error("bad")));
    render(<AiSummarySection clinicId="c1" />);
    await userEvent.type(field(), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Save key" }));
    expect(showToast).toHaveBeenCalledWith("msg:bad", "error");
    expect(field().value).toBe("abc");
  });

  it("shows the privacy notice and Get a key link", () => {
    render(<AiSummarySection clinicId="c1" />);
    expect(
      screen.getByText(
        "Patient case notes (not name or phone) are sent to Google Gemini when a summary is generated. Use a key from a Google Cloud project with billing enabled — Google may use free-tier requests to improve its products. Avoid writing patient names or other identifying details in notes.",
      ),
    ).toBeTruthy();
    const a = screen.getByRole("link", { name: /Get a key/ });
    expect(a.getAttribute("href")).toBe("https://aistudio.google.com/apikey");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
