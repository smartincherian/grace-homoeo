import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
}));
const sendPasswordResetEmail = h.sendPasswordResetEmail;
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  sendPasswordResetEmail: (...a: unknown[]) => h.sendPasswordResetEmail(...a),
  signInWithEmailAndPassword: (...a: unknown[]) =>
    h.signInWithEmailAndPassword(...a),
  createUserWithEmailAndPassword: (...a: unknown[]) =>
    h.createUserWithEmailAndPassword(...a),
  sendEmailVerification: (...a: unknown[]) => h.sendEmailVerification(...a),
  signInWithPopup: vi.fn(),
  signOut: (...a: unknown[]) => h.signOut(...a),
}));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("../../lib/firebase", () => ({ auth: { name: "auth" } }));
vi.mock("../../lib/access", () => ({
  getMembership: vi.fn(),
  homePath: vi.fn(),
}));
vi.mock("./ensureUserDoc", () => ({ ensureUserDoc: vi.fn() }));
vi.mock("../../components/ScriptureBanner", () => ({ default: () => null }));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import { FirebaseError } from "firebase/app";
import { getMembership } from "../../lib/access";
import LoginPage from "./LoginPage";

const renderLogin = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  sendPasswordResetEmail.mockReset();
  showToast.mockReset();
  Object.values(h).forEach((f) => f.mockReset());
});

test("shows the generic brand and footer, no Grace text", () => {
  const { container } = renderLogin();
  // The developer credit links to graceissufficient.net; check the rest.
  container.querySelector("footer")?.remove();
  expect(
    screen.getByRole("heading", { name: "HomoeoDesk" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Homoeo Clinic Manager")).toBeInTheDocument();
  expect(screen.getByText(/developed by/i)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/grace/i);
});

test("Forgot password asks for an email first", async () => {
  const user = userEvent.setup();
  renderLogin();
  await user.click(screen.getByRole("button", { name: /forgot password/i }));
  expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledWith(
    expect.stringMatching(/enter your email/i),
    "info",
  );
});

test("Forgot password sends a reset email to the typed address", async () => {
  sendPasswordResetEmail.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderLogin();
  await user.type(screen.getByLabelText(/email/i), "doc@gmail.com");
  await user.click(screen.getByRole("button", { name: /forgot password/i }));
  expect(sendPasswordResetEmail).toHaveBeenCalledWith(
    { name: "auth" },
    "doc@gmail.com",
  );
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/reset link/i),
      "success",
    ),
  );
});

test("password sign-in of an unverified user goes to /verify-email", async () => {
  h.signInWithEmailAndPassword.mockResolvedValue({
    user: { uid: "u1", email: "doc@gmail.com", emailVerified: false },
  });
  const user = userEvent.setup();
  renderLogin();
  await user.type(screen.getByLabelText(/email/i), "doc@gmail.com");
  await user.type(screen.getByLabelText(/password/i), "secret1");
  await user.click(screen.getByRole("button", { name: "Sign In" }));
  await waitFor(() =>
    expect(h.navigate).toHaveBeenCalledWith("/verify-email", { replace: true }),
  );
  expect(getMembership).not.toHaveBeenCalled();
  expect(h.signOut).not.toHaveBeenCalled();
  expect(showToast).not.toHaveBeenCalled();
});

const openCreate = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /create account/i }));
  await user.type(screen.getByLabelText(/email/i), "new@gmail.com");
  await user.type(screen.getByLabelText(/password/i), "secret1");
};

test("Create account toggle creates the account, emails a verification link and goes to /verify-email", async () => {
  const created = { uid: "u2", email: "new@gmail.com" };
  h.createUserWithEmailAndPassword.mockResolvedValue({ user: created });
  h.sendEmailVerification.mockResolvedValue(undefined);
  const user = userEvent.setup();
  renderLogin();
  await openCreate(user);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() =>
    expect(h.navigate).toHaveBeenCalledWith("/verify-email", {
      replace: true,
      state: { justSent: true },
    }),
  );
  expect(h.createUserWithEmailAndPassword).toHaveBeenCalledWith(
    { name: "auth" },
    "new@gmail.com",
    "secret1",
  );
  expect(h.sendEmailVerification).toHaveBeenCalledWith(created);
});

test("Create account still goes to /verify-email when the verification send fails", async () => {
  h.createUserWithEmailAndPassword.mockResolvedValue({
    user: { uid: "u2", email: "new@gmail.com" },
  });
  h.sendEmailVerification.mockRejectedValue(new Error("boom"));
  const user = userEvent.setup();
  renderLogin();
  await openCreate(user);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() =>
    expect(h.navigate).toHaveBeenCalledWith("/verify-email", {
      replace: true,
      state: { justSent: false },
    }),
  );
  expect(showToast).not.toHaveBeenCalled();
});

test("password field autocomplete follows the mode", async () => {
  const user = userEvent.setup();
  renderLogin();
  const pw = () => screen.getByLabelText(/password/i);
  expect(pw()).toHaveAttribute("autocomplete", "current-password");
  await user.click(screen.getByRole("button", { name: /create account/i }));
  expect(pw()).toHaveAttribute("autocomplete", "new-password");
});

test.each([
  [
    "auth/email-already-in-use",
    "An account already exists for this email. Sign in or reset your password.",
  ],
  ["auth/weak-password", "Password must be at least 6 characters."],
])("Create account maps %s to a friendly toast", async (code, message) => {
  h.createUserWithEmailAndPassword.mockRejectedValue(
    new FirebaseError(code, "x"),
  );
  const user = userEvent.setup();
  renderLogin();
  await openCreate(user);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(showToast).toHaveBeenCalledWith(message, "error"));
  expect(h.navigate).not.toHaveBeenCalled();
});
