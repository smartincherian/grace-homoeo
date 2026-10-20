import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirebaseError } from "firebase/app";

const linkWithCredential = vi.fn();
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ email, password }),
  },
  linkWithCredential: (...a: unknown[]) => linkWithCredential(...a),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import SetPasswordDialog, { hasPassword } from "./SetPasswordDialog";

const user = { email: "doc@gmail.com", providerData: [] } as never;

beforeEach(() => {
  linkWithCredential.mockReset();
  showToast.mockReset();
});

const fill = async (password: string, confirm: string) => {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText(/^new password/i), password);
  await u.type(screen.getByLabelText(/confirm password/i), confirm);
  await u.click(screen.getByRole("button", { name: /set password/i }));
};

test("hasPassword checks for the password provider", () => {
  expect(
    hasPassword({ providerData: [{ providerId: "google.com" }] } as never),
  ).toBe(false);
  expect(
    hasPassword({
      providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    } as never),
  ).toBe(true);
});

test("links an email/password credential to the signed-in user", async () => {
  linkWithCredential.mockResolvedValue({});
  const onClose = vi.fn();
  render(<SetPasswordDialog open user={user} onClose={onClose} />);
  await fill("secret12", "secret12");
  expect(linkWithCredential).toHaveBeenCalledWith(user, {
    email: "doc@gmail.com",
    password: "secret12",
  });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(showToast).toHaveBeenCalledWith(
    expect.stringMatching(/password set/i),
    "success",
  );
});

test("rejects mismatched passwords without calling Firebase", async () => {
  render(<SetPasswordDialog open user={user} onClose={vi.fn()} />);
  await fill("secret12", "secret13");
  expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  expect(linkWithCredential).not.toHaveBeenCalled();
});

test("rejects passwords shorter than 6 characters", async () => {
  render(<SetPasswordDialog open user={user} onClose={vi.fn()} />);
  await fill("abc", "abc");
  expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
  expect(linkWithCredential).not.toHaveBeenCalled();
});

test("asks for a fresh sign-in when Firebase requires recent login", async () => {
  linkWithCredential.mockRejectedValue(
    new FirebaseError("auth/requires-recent-login", "x"),
  );
  const onClose = vi.fn();
  render(<SetPasswordDialog open user={user} onClose={onClose} />);
  await fill("secret12", "secret12");
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/sign out and sign in again/i),
      "error",
    ),
  );
  expect(onClose).not.toHaveBeenCalled();
});
