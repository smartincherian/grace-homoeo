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
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import VerifyEmailPage from "./VerifyEmailPage";

const renderPage = (qc = new QueryClient()) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/verify-email"]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>login page</div>} />
          <Route path="/" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(h)
    .filter((v): v is ReturnType<typeof vi.fn> => typeof v === "function")
    .forEach((f) => f.mockReset());
  showToast.mockReset();
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
  renderPage();
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
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Please wait a minute before resending.",
      "error",
    ),
  );
});

test("I've verified reloads, refreshes the token, clears cached access and goes home", async () => {
  h.reload.mockImplementation(async () => {
    h.fbAuth.currentUser = { emailVerified: true };
  });
  const qc = new QueryClient();
  qc.setQueryData(["access", "u1"], null);
  renderPage(qc);
  await userEvent.click(screen.getByRole("button", { name: "I've verified" }));
  expect(await screen.findByText("home page")).toBeInTheDocument();
  expect(h.reload).toHaveBeenCalled();
  expect(h.getIdToken).toHaveBeenCalledWith(true);
  expect(qc.getQueryData(["access", "u1"])).toBeUndefined();
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
