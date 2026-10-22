import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const callable = vi.fn();
const httpsCallable = vi.fn((_f: unknown, _name: string) => callable);
vi.mock("firebase/functions", () => ({
  httpsCallable: (f: unknown, name: string) => httpsCallable(f, name),
}));
const getDoc = vi.fn();
vi.mock("firebase/firestore", () => ({
  getDoc: (...a: unknown[]) => getDoc(...a),
  doc: (...a: unknown[]) => ({ path: a.slice(1).join("/") }),
  collection: vi.fn(),
}));
vi.mock("./firebase", () => ({ db: {}, functions: { fake: true } }));
const notifyWriteDenied = vi.fn();
vi.mock("./writeDenied", () => ({ notifyWriteDenied: () => notifyWriteDenied() }));

import { setActiveClinic } from "./clinic";
import {
  aiErrorMessage,
  aiStatusSchema,
  useAiStatus,
  useSaveAiKey,
  useSummarizePatient,
} from "./aiSummary";

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

const status = {
  provider: "gemini",
  configured: true,
  last4: "abcd",
  model: "m",
  updatedAt: 1,
  updatedBy: "o@x.com",
};
const summary = {
  bullets: ["a"],
  generatedAt: 5,
  generatedBy: "u",
  generatedByName: "U",
  model: "m",
  consultationCount: 2,
  lastConsultationAt: null,
};

beforeEach(() => {
  callable.mockReset();
  httpsCallable.mockClear();
  getDoc.mockReset();
  notifyWriteDenied.mockReset();
  setActiveClinic("c1");
});

describe("aiSummary", () => {
  it("aiStatusSchema parses a missing doc as not configured", () => {
    const s = aiStatusSchema.parse(undefined);
    expect(s.configured).toBe(false);
    expect(s.last4).toBe("");
  });

  it("useAiStatus reads settings/ai and tolerates a missing doc", async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const { wrapper } = wrap();
    const { result } = renderHook(() => useAiStatus("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.configured).toBe(false);
  });

  it("useSaveAiKey calls saveAiKey with { clinicId, apiKey } and sets status", async () => {
    callable.mockResolvedValue({ data: status });
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useSaveAiKey("c1"), { wrapper });
    await act(() => result.current.mutateAsync("sekret"));
    expect(httpsCallable).toHaveBeenCalledWith({ fake: true }, "saveAiKey");
    expect(callable).toHaveBeenCalledWith({ clinicId: "c1", apiKey: "sekret" });
    expect(qc.getQueryData(["aiStatus", "c1"])).toEqual(status);
  });

  it("useSummarizePatient calls summarizePatient with { clinicId, patientId } and sets summary data", async () => {
    callable.mockResolvedValue({ data: summary });
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useSummarizePatient("p1"), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(httpsCallable).toHaveBeenCalledWith({ fake: true }, "summarizePatient");
    expect(callable).toHaveBeenCalledWith({ clinicId: "c1", patientId: "p1" });
    expect(qc.getQueryData(["patientSummary", "c1", "p1"])).toEqual(summary);
  });

  it("trial-ended error triggers notifyWriteDenied; permission-denied does not", async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useSummarizePatient("p1"), { wrapper });
    callable.mockRejectedValueOnce(
      Object.assign(new Error("Trial ended"), {
        code: "functions/failed-precondition",
        details: { reason: "trial-ended" },
      }),
    );
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(notifyWriteDenied).toHaveBeenCalledTimes(1);

    callable.mockRejectedValueOnce(
      Object.assign(new Error("No"), { code: "functions/permission-denied" }),
    );
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(notifyWriteDenied).toHaveBeenCalledTimes(1);
  });

  it("aiErrorMessage returns the callable message", () => {
    expect(aiErrorMessage(Object.assign(new Error("Key rejected"), { code: "functions/x" }))).toBe(
      "Key rejected",
    );
    expect(aiErrorMessage("boom")).toBe("Something went wrong, try again.");
  });
});
