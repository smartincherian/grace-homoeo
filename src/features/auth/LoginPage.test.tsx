import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const sendPasswordResetEmail = vi.fn();
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
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
