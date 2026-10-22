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
  useRemoveAiKey,
  usePatientSummary,
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

  it("useSaveAiKey does not keep the key in mutation state after settle", async () => {
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useSaveAiKey("c1"), { wrapper });
    const keys = () =>
      qc.getMutationCache().getAll().filter((m) => m.state.variables === "sekret");
    callable.mockResolvedValueOnce({ data: status });
    await act(() => result.current.mutateAsync("sekret"));
    await waitFor(() => expect(result.current.variables).toBeUndefined());
    await waitFor(() => expect(keys()).toHaveLength(0));
    callable.mockRejectedValueOnce(Object.assign(new Error("bad"), { code: "functions/x" }));
    await act(() => result.current.mutateAsync("sekret").catch(() => undefined));
    await waitFor(() => expect(result.current.variables).toBeUndefined());
    await waitFor(() => expect(keys()).toHaveLength(0));
  });

  it("useRemoveAiKey calls removeAiKey with { clinicId } and sets status", async () => {
    const off = { ...status, configured: false, last4: "" };
    callable.mockResolvedValue({ data: off });
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useRemoveAiKey("c1"), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(httpsCallable).toHaveBeenCalledWith({ fake: true }, "removeAiKey");
    expect(callable).toHaveBeenCalledWith({ clinicId: "c1" });
    expect(qc.getQueryData(["aiStatus", "c1"])).toEqual(off);
  });

  it("useSummarizePatient calls summarizePatient with { clinicId, patientId } and sets summary data", async () => {
    callable.mockResolvedValue({ data: summary });
    const { wrapper, qc } = wrap();
    const { result } = renderHook(() => useSummarizePatient("c1", "p1"), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(httpsCallable).toHaveBeenCalledWith({ fake: true }, "summarizePatient");
    expect(callable).toHaveBeenCalledWith({ clinicId: "c1", patientId: "p1" });
    expect(qc.getQueryData(["patientSummary", "c1", "p1"])).toEqual(summary);
  });

  it("trial-ended error triggers notifyWriteDenied; permission-denied does not", async () => {
    const { wrapper } = wrap();
    const { result } = renderHook(() => useSummarizePatient("c1", "p1"), { wrapper });
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

  it("usePatientSummary reads the summary doc and stays idle without a clinic", async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => summary });
    const { wrapper } = wrap();
    const { result } = renderHook(() => usePatientSummary("c1", "p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
    getDoc.mockClear();
    const idle = renderHook(() => usePatientSummary(undefined, "p1"), { wrapper });
    expect(idle.result.current.fetchStatus).toBe("idle");
    expect(getDoc).not.toHaveBeenCalled();
  });

  it("hooks do not need an active clinic", () => {
    setActiveClinic("");
    const { wrapper } = wrap();
    expect(() => renderHook(() => usePatientSummary("c1", "p1"), { wrapper })).not.toThrow();
    expect(() => renderHook(() => useSummarizePatient("c1", "p1"), { wrapper })).not.toThrow();
  });

  it.each(["no-key", "key-rejected"])("%s error invalidates the AI status", async (reason) => {
    const { wrapper, qc } = wrap();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSummarizePatient("c1", "p1"), { wrapper });
    callable.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "functions/failed-precondition", details: { reason } }),
    );
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["aiStatus", "c1"] });
  });

  it("other errors do not invalidate the AI status", async () => {
    const { wrapper, qc } = wrap();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSummarizePatient("c1", "p1"), { wrapper });
    callable.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "functions/internal" }));
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(spy).not.toHaveBeenCalled();
  });

  it("aiErrorMessage hides a bare error code", () => {
    expect(aiErrorMessage(Object.assign(new Error("internal"), { code: "functions/internal" }))).toBe(
      "Something went wrong, try again.",
    );
  });

  it("aiErrorMessage returns the callable message", () => {
    expect(aiErrorMessage(Object.assign(new Error("Key rejected"), { code: "functions/x" }))).toBe(
      "Key rejected",
    );
    expect(aiErrorMessage("boom")).toBe("Something went wrong, try again.");
  });
});
