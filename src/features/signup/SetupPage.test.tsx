import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  isSlugTaken: vi.fn(),
  createOwnClinic: vi.fn(),
  getAccess: vi.fn(),
  ensureUserDoc: vi.fn(),
  showToast: vi.fn(),
  patientsRendered: vi.fn(),
}));
vi.mock("firebase/auth", () => ({ signOut: vi.fn() }));
vi.mock("../../lib/firebase", () => ({ auth: {} }));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: h.user, loading: false }),
}));
vi.mock("../../lib/ensureUserDoc", () => ({
  ensureUserDoc: (...a: unknown[]) => h.ensureUserDoc(...a),
}));
vi.mock("../../lib/access", () => ({
  getAccess: (...a: unknown[]) => h.getAccess(...a),
  homePath: (m: { clinicId: string }) => `/${m.clinicId}/patients`,
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast: h.showToast }),
}));
vi.mock("../../components/BottomDock", () => ({ default: () => null }));
vi.mock("./signupRepo", () => ({
  isSlugTaken: (...a: unknown[]) => h.isSlugTaken(...a),
  createOwnClinic: (...a: unknown[]) => h.createOwnClinic(...a),
}));

import SetupPage from "./SetupPage";

function Patients() {
  h.patientsRendered();
  return <div>PATIENTS-ROUTE-RENDERED</div>;
}

function renderPage(qc = new QueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/setup"]}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/verify-email" element={<div>verify page</div>} />
          <Route path="/:slug/settings" element={<div>settings page</div>} />
          <Route path="/:slug/patients" element={<Patients />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { uid: "u1", email: "o@x.com", emailVerified: true };
  h.getAccess.mockResolvedValue("signup");
  h.isSlugTaken.mockResolvedValue(false);
  h.createOwnClinic.mockResolvedValue(undefined);
});

describe("SetupPage", () => {
  it("redirects signed-out and unverified users", () => {
    h.user = null;
    renderPage();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("sends unverified users to verify-email", () => {
    h.user = { uid: "u1", email: "o@x.com", emailVerified: false };
    renderPage();
    expect(screen.getByText("verify page")).toBeInTheDocument();
  });

  it("redirects existing members home", async () => {
    h.getAccess.mockResolvedValue({ superadmin: false, clinicId: "abc" });
    renderPage();
    expect(
      await screen.findByText("PATIENTS-ROUTE-RENDERED"),
    ).toBeInTheDocument();
  });

  it("derives the web address and gates the button on the name", async () => {
    renderPage();
    const btn = screen.getByRole("button", { name: "Register for free" });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    expect(screen.getByLabelText("Web address")).toHaveValue("sun-clinic");
    expect(await screen.findByText("✓ Available")).toBeInTheDocument();
    expect(h.isSlugTaken).toHaveBeenLastCalledWith("sun-clinic");
    expect(btn).toBeEnabled();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
    expect(screen.queryByText(/People page/)).not.toBeInTheDocument();
  });

  it("shows a taken web address in red and blocks registering", async () => {
    h.isSlugTaken.mockResolvedValue(true);
    renderPage();
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    expect(
      await screen.findByText("✗ That web address is taken, try another"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register for free" }),
    ).toBeDisabled();
    expect(h.createOwnClinic).not.toHaveBeenCalled();
  });

  it("re-checks when the web address is edited", async () => {
    h.isSlugTaken.mockImplementation(async (s: string) => s === "sun-clinic");
    renderPage();
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    await screen.findByText("✗ That web address is taken, try another");
    const field = screen.getByLabelText("Web address");
    await userEvent.clear(field);
    await userEvent.type(field, "sun-clinic-kochi");
    expect(await screen.findByText("✓ Available")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register for free" }),
    ).toBeEnabled();
  });

  it("still blocks a slug taken between the check and the submit", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    await screen.findByText("✓ Available");
    h.isSlugTaken.mockResolvedValue(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Register for free" }),
    );
    expect(
      await screen.findByText("✗ That web address is taken, try another"),
    ).toBeInTheDocument();
    expect(h.createOwnClinic).not.toHaveBeenCalled();
  });

  it("creates the clinic, refreshes access and lands on settings", async () => {
    const qc = new QueryClient();
    renderPage(qc);
    // Like the real network write: slow enough for the access update to render.
    h.ensureUserDoc.mockImplementation(
      () => new Promise((r) => setTimeout(r, 50)),
    );
    h.getAccess.mockResolvedValue({
      superadmin: false,
      clinicId: "sun-clinic",
    });
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    await screen.findByText("✓ Available");
    await userEvent.click(
      screen.getByRole("button", { name: "Register for free" }),
    );
    expect(await screen.findByText("settings page")).toBeInTheDocument();
    expect(h.createOwnClinic).toHaveBeenCalledWith(
      "sun-clinic",
      "Sun Clinic",
      "o@x.com",
    );
    expect(h.patientsRendered).not.toHaveBeenCalled();
    expect(h.ensureUserDoc).toHaveBeenCalled();
    expect(h.createOwnClinic.mock.invocationCallOrder[0]).toBeLessThan(
      h.ensureUserDoc.mock.invocationCallOrder[0],
    );
    expect(qc.getQueryData(["access", "u1"])).toEqual({
      superadmin: false,
      clinicId: "sun-clinic",
    });
  });

  it("toasts when the commit is denied", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.createOwnClinic.mockRejectedValue(new Error("denied"));
    renderPage();
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    await screen.findByText("✓ Available");
    await userEvent.click(
      screen.getByRole("button", { name: "Register for free" }),
    );
    await waitFor(() =>
      expect(h.showToast).toHaveBeenCalledWith(
        "Couldn't create the clinic. Check your phone's date and time, then try again.",
        "error",
      ),
    );
  });

  it("re-resolves access when a step after the commit fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const qc = new QueryClient();
    renderPage(qc);
    h.getAccess
      .mockRejectedValueOnce(new Error("offline")) // right after the commit
      .mockResolvedValue({ superadmin: false, clinicId: "sun-clinic" });
    await userEvent.type(screen.getByLabelText(/Clinic name/), "Sun Clinic");
    await screen.findByText("✓ Available");
    await userEvent.click(
      screen.getByRole("button", { name: "Register for free" }),
    );
    expect(
      await screen.findByText("PATIENTS-ROUTE-RENDERED"),
    ).toBeInTheDocument();
    expect(h.createOwnClinic).toHaveBeenCalledTimes(1);
  });
});
