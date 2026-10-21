import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FirebaseError } from "firebase/app";

const h = vi.hoisted(() => ({
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
  reload: vi.fn(),
  getIdToken: vi.fn(),
  authUser: null as null | Record<string, unknown>,
  fbAuth: { currentUser: null as null | { emailVerified: boolean } },
}));
vi.mock("firebase/auth", () => ({
  sendEmailVerification: (...a: unknown[]) => h.sendEmailVerification(...a),
  signOut: (...a: unknown[]) => h.signOut(...a),
}));
vi.mock("../../lib/firebase", () => ({ auth: h.fbAuth }));
vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: h.authUser, loading: false }),
}));
const access = vi.hoisted(() => ({ getAccess: vi.fn() }));
const eud = vi.hoisted(() => ({ ensureUserDoc: vi.fn() }));
vi.mock("../../lib/access", () => ({
  getAccess: (...a: unknown[]) => access.getAccess(...a),
  homePath: (m: { superadmin: boolean; clinicId: string | null }) =>
    m.superadmin ? "/admin" : `/${m.clinicId}/patients`,
}));
vi.mock("../../lib/ensureUserDoc", () => ({
  ensureUserDoc: (...a: unknown[]) => eud.ensureUserDoc(...a),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import VerifyEmailPage from "./VerifyEmailPage";

const renderPage = (qc = new QueryClient(), state?: unknown) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[{ pathname: "/verify-email", state }]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/setup" element={<div>setup page</div>} />
          <Route path="/" element={<div>home page</div>} />
          <Route path="/c1/patients" element={<div>clinic page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(h)
    .filter((v): v is ReturnType<typeof vi.fn> => typeof v === "function")
    .forEach((f) => f.mockReset());
  showToast.mockReset();
  access.getAccess.mockReset();
  eud.ensureUserDoc.mockReset();
  h.sendEmailVerification.mockResolvedValue(undefined);
  h.reload.mockResolvedValue(undefined);
  h.getIdToken.mockResolvedValue("tok");
  h.fbAuth.currentUser = { emailVerified: false };
  h.authUser = {
    uid: "u1",
    email: "new@gmail.com",
    reload: h.reload,
    getIdToken: h.getIdToken,
  };
});

test("redirects to /login when nobody is signed in", () => {
  h.authUser = null;
  renderPage();
  expect(screen.getByText("login page")).toBeInTheDocument();
});

test("shows the email being verified", () => {
  renderPage();
  expect(screen.getByText("new@gmail.com")).toBeInTheDocument();
});

test("Resend email sends a verification email and toasts", async () => {
  h.sendEmailVerification.mockResolvedValue(undefined);
  renderPage(new QueryClient(), { justSent: true });
  await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/sent/i),
      "success",
    ),
  );
  expect(h.sendEmailVerification).toHaveBeenCalledWith(h.authUser);
});

test("Resend email maps too-many-requests", async () => {
  h.sendEmailVerification.mockRejectedValue(
    new FirebaseError("auth/too-many-requests", "x"),
  );
  renderPage(new QueryClient(), { justSent: true });
  await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Please wait a minute before resending.",
      "error",
    ),
  );
});

const verifyNow = () =>
  h.reload.mockImplementation(async () => {
    h.fbAuth.currentUser = { emailVerified: true };
  });

test("I've verified with a membership caches it, ensures the user doc and goes to the clinic", async () => {
  verifyNow();
  const m = { superadmin: false, clinicId: "c1", owner: false };
  access.getAccess.mockResolvedValue(m);
  const qc = new QueryClient();
  renderPage(qc);
  await userEvent.click(screen.getByRole("button", { name: "I've verified" }));
  expect(await screen.findByText("clinic page")).toBeInTheDocument();
  expect(h.reload).toHaveBeenCalled();
  expect(h.getIdToken).toHaveBeenCalledWith(true);
  expect(qc.getQueryData(["access", "u1"])).toEqual(m);
  expect(eud.ensureUserDoc).toHaveBeenCalledWith(h.authUser);
});

test("I've verified without a membership toasts and signs out", async () => {
  verifyNow();
  access.getAccess.mockResolvedValue(null);
  h.signOut.mockResolvedValue(undefined);
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "I've verified" }));
  expect(await screen.findByText("login page")).toBeInTheDocument();
  expect(showToast).toHaveBeenCalledWith(
    "new@gmail.com is not allowed to sign in.",
    "error",
  );
  expect(h.signOut).toHaveBeenCalledWith(h.fbAuth);
  expect(eud.ensureUserDoc).not.toHaveBeenCalled();
});

test("sends the verification email once on mount", async () => {
  renderPage();
  await waitFor(() => expect(h.sendEmailVerification).toHaveBeenCalledTimes(1));
  expect(h.sendEmailVerification).toHaveBeenCalledWith(h.authUser);
});

test("does not auto-send when the create-account path just sent it", () => {
  renderPage(new QueryClient(), { justSent: true });
  expect(h.sendEmailVerification).not.toHaveBeenCalled();
});

test("auto-send swallows too-many-requests silently", async () => {
  h.sendEmailVerification.mockRejectedValue(
    new FirebaseError("auth/too-many-requests", "x"),
  );
  renderPage();
  await waitFor(() => expect(h.sendEmailVerification).toHaveBeenCalled());
  expect(showToast).not.toHaveBeenCalled();
});

test("I've verified toasts when still unverified", async () => {
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "I've verified" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Not verified yet. Check your inbox and spam folder.",
      "info",
    ),
  );
  expect(screen.queryByText("home page")).not.toBeInTheDocument();
});

test("Use a different account signs out and goes to /login", async () => {
  h.signOut.mockResolvedValue(undefined);
  renderPage();
  await userEvent.click(
    screen.getByRole("button", { name: "Use a different account" }),
  );
  expect(await screen.findByText("login page")).toBeInTheDocument();
  expect(h.signOut).toHaveBeenCalledWith(h.fbAuth);
});

test("I've verified with no clinic goes to /setup without ensureUserDoc", async () => {
  verifyNow();
  access.getAccess.mockResolvedValue("signup");
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "I've verified" }));
  expect(await screen.findByText("setup page")).toBeInTheDocument();
  expect(eud.ensureUserDoc).not.toHaveBeenCalled();
  expect(h.signOut).not.toHaveBeenCalled();
});
