import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("firebase/auth", () => ({
  signOut: (...a: unknown[]) => signOut(...a),
}));
vi.mock("../lib/firebase", () => ({ auth: {} }));
const authUser = vi.hoisted(() => ({
  email: "doc@example.com",
  providerData: [] as { providerId: string }[],
}));
vi.mock("../features/auth/SetPasswordDialog", () => ({
  default: () => <div role="dialog">Set a password</div>,
  hasPassword: (u: { providerData: { providerId: string }[] }) =>
    u.providerData.some((p) => p.providerId === "password"),
}));
vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({ user: authUser, loading: false }),
}));
const useClinic = vi.hoisted(() => vi.fn());
vi.mock("../lib/clinicQueries", () => ({
  useClinic: (id: string | undefined) => useClinic(id),
}));
const useBranding = vi.hoisted(() => vi.fn());
vi.mock("../lib/useBranding", () => ({
  useBranding: (id: string | undefined) => useBranding(id),
}));
const membership = vi.hoisted(() => ({
  value: { superadmin: true, clinicId: null, owner: false } as {
    superadmin: boolean;
    clinicId: string | null;
    owner: boolean;
  },
}));
vi.mock("../features/auth/AuthGuard", () => ({
  useMembership: () => membership.value,
}));
const setActiveClinic = vi.fn();
vi.mock("../lib/clinic", () => ({
  setActiveClinic: (...a: unknown[]) => setActiveClinic(...a),
}));

beforeEach(() => {
  membership.value = { superadmin: true, clinicId: null, owner: false };
  setActiveClinic.mockClear();
  useBranding.mockReset();
  useBranding.mockReturnValue({ data: undefined });
  useClinic.mockReset();
  useClinic.mockImplementation((id: string | undefined) => ({
    data: id ? { id, name: `Clinic ${id}`, createdAt: 0 } : undefined,
  }));
});

import AppShell from "./AppShell";
import { useSetPageTitle } from "./PageChrome";

/** Mounts the shell as the app does: a layout route above the clinic routes. */
const renderShell = (
  entries: string[],
  children?: React.ReactNode,
  qc = new QueryClient(),
) =>
  render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme}>
        <MemoryRouter
          initialEntries={entries}
          initialIndex={entries.length - 1}
        >
          <Routes>
            <Route element={<AppShell>{children}</AppShell>}>
              <Route path="/admin" element={null} />
              <Route path="/:clinicSlug/people" element={<p>people route</p>} />
              <Route path="/:clinicSlug/*" element={null} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );

test("a member does not fetch a clinic other than their own", () => {
  membership.value = { superadmin: false, clinicId: "c1", owner: false };
  renderShell(["/c2/patients"]);
  expect(useClinic).not.toHaveBeenCalledWith("c2");
});

test("a member fetches their own clinic", () => {
  membership.value = { superadmin: false, clinicId: "c1", owner: false };
  renderShell(["/c1/patients"]);
  expect(screen.getByText("Clinic c1")).toBeInTheDocument();
});

test("renders clinic-scoped navigation to every module", () => {
  renderShell(["/c1/patients"]);
  expect(screen.getByRole("link", { name: /patients/i })).toHaveAttribute(
    "href",
    "/c1/patients",
  );
  expect(screen.getByRole("link", { name: /inventory/i })).toHaveAttribute(
    "href",
    "/c1/inventory",
  );
  expect(screen.getByRole("link", { name: /funds/i })).toHaveAttribute(
    "href",
    "/c1/funds",
  );
  expect(screen.getByText("Clinic c1")).toBeInTheDocument();
});

test("hides the clinic navigation on the admin page", () => {
  renderShell(["/admin"]);
  expect(
    screen.queryByRole("link", { name: /patients/i }),
  ).not.toBeInTheDocument();
});

test("offers the superadmin an Admin menu item", async () => {
  const user = userEvent.setup();
  authUser.email = "smartin.cherian@gmail.com";
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  expect(screen.getByRole("menuitem", { name: "Admin" })).toBeInTheDocument();
  authUser.email = "doc@example.com";
});

test("offers Set password to an account without a password", async () => {
  const user = userEvent.setup();
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: /set password/i }));
  expect(screen.getByRole("dialog")).toHaveTextContent(/set a password/i);
});

test("hides Set password once the account has one", async () => {
  const user = userEvent.setup();
  authUser.providerData = [{ providerId: "password" }];
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  expect(
    screen.queryByRole("menuitem", { name: /set password/i }),
  ).not.toBeInTheDocument();
  authUser.providerData = [];
});

test("account menu signs the user out", async () => {
  const user = userEvent.setup();
  const qc = new QueryClient();
  qc.setQueryData(["patients"], [{ id: "p1" }]);
  renderShell(["/c1/patients"], <div />, qc);
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(setActiveClinic).toHaveBeenCalledWith(null));
  expect(qc.getQueryData(["patients"])).toBeUndefined();
});

function TitleSetter() {
  useSetPageTitle("Patient details");
  return <div>page body</div>;
}

test("shows a back button on a non-root route and navigates back on click", async () => {
  const user = userEvent.setup();
  renderShell(["/c1/patients", "/c1/patients/p1"], <TitleSetter />);
  const back = screen.getByRole("button", { name: /back/i });
  expect(back).toBeInTheDocument();
  await user.click(back);
});

test("hides the back button on a root tab", () => {
  renderShell(["/c1/patients"], <div />);
  expect(
    screen.queryByRole("button", { name: /back/i }),
  ).not.toBeInTheDocument();
});

test("shows People to the clinic owner and navigates to it", async () => {
  const user = userEvent.setup();
  membership.value = { superadmin: false, clinicId: "c1", owner: true };
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: "People" }));
  expect(await screen.findByText("people route")).toBeInTheDocument();
});

test("hides People from a non-owner member", async () => {
  const user = userEvent.setup();
  membership.value = { superadmin: false, clinicId: "c1", owner: false };
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  expect(screen.queryByRole("menuitem", { name: "People" })).toBeNull();
});

const branded = (over: object) => ({
  data: {
    displayName: "Teal Clinic",
    logoDataUrl: "",
    primaryColor: "#0f766e",
    showScripture: true,
    contact: {},
    ...over,
  },
});

test("shows the branding display name and an initial tile without a logo", () => {
  useBranding.mockReturnValue(branded({}));
  renderShell(["/c1/patients"]);
  expect(screen.getAllByText("Teal Clinic").length).toBeGreaterThan(0);
  expect(screen.getByText("T")).toBeInTheDocument();
  expect(screen.queryByText("Clinic c1")).toBeNull();
});

test("shows the clinic logo image when one is set", () => {
  useBranding.mockReturnValue(
    branded({ logoDataUrl: "data:image/png;base64,AA" }),
  );
  renderShell(["/c1/patients"]);
  expect(screen.getByRole("img", { name: "Teal Clinic" })).toHaveAttribute(
    "src",
    "data:image/png;base64,AA",
  );
});

test("hides scripture but keeps the footer when branding turns it off", () => {
  useBranding.mockReturnValue(branded({ showScripture: false }));
  renderShell(["/c1/patients"]);
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  expect(screen.queryByText(/\d+:\d+/)).toBeNull();
});

test("shows HomoeoDesk and no clinic name on the admin page", () => {
  renderShell(["/admin"]);
  expect(screen.getAllByText("HomoeoDesk").length).toBeGreaterThan(0);
  expect(screen.queryByText(/^Clinic /)).toBeNull();
  expect(useBranding).not.toHaveBeenCalledWith("admin");
});

test("shows scripture when branding leaves it on", () => {
  useBranding.mockReturnValue(branded({ showScripture: true }));
  renderShell(["/c1/patients"]);
  expect(screen.getByText(/\d+:\d+/)).toBeInTheDocument();
});

test("shows Settings to the clinic owner and hides it from members", async () => {
  const user = userEvent.setup();
  membership.value = { superadmin: false, clinicId: "c1", owner: true };
  const { unmount } = renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  unmount();
  membership.value = { superadmin: false, clinicId: "c1", owner: false };
  renderShell(["/c1/patients"]);
  await user.click(screen.getByRole("button", { name: /account/i }));
  expect(screen.queryByRole("menuitem", { name: "Settings" })).toBeNull();
});
