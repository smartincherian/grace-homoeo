import { vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DEFAULT_BRANDING, type Branding } from "../../lib/branding";

const branding = vi.hoisted(() => ({
  value: undefined as Branding | undefined,
  isError: false,
  refetch: undefined as unknown as ReturnType<typeof vi.fn>,
}));
const saveMutate = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
const resize = vi.hoisted(() => vi.fn());

vi.mock("../../lib/useBranding", () => ({
  useBranding: () => ({
    data: branding.value,
    status: "success",
    isError: branding.isError,
    refetch: branding.refetch,
  }),
  useSaveBranding: () => ({ mutate: saveMutate, isPending: false }),
}));
vi.mock("../../lib/clinicQueries", () => ({
  useClinic: () => ({ data: { id: "c1", name: "Clinic One", createdAt: 0 } }),
  useClinicTimeZone: () => "Asia/Kolkata",
}));
vi.mock("../../lib/schedule", async (orig) => ({
  ...(await orig<typeof import("../../lib/schedule")>()),
  useSchedule: () => ({ data: undefined, isError: false }),
  useSaveSchedule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("./AiSummarySection", () => ({
  default: () => null,
}));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "Owner@X.com" }, loading: false }),
}));
vi.mock("../../components/useToast", () => ({
  useToast: () => ({ showToast }),
}));
vi.mock("./resizeLogo", () => ({
  resizeLogo: (...a: unknown[]) => resize(...a),
}));

import SettingsPage from "./SettingsPage";
import { PageChromeProvider } from "../../components/PageChrome";

const SAVED: Branding = {
  displayName: "Grace Homoeo",
  logoDataUrl: "",
  primaryColor: "#2f6bff",
  showScripture: true,
  contact: { ...DEFAULT_BRANDING.contact, doctorName: "Dr A" },
};

beforeEach(() => {
  branding.value = SAVED;
  branding.isError = false;
  branding.refetch = vi.fn();
  saveMutate.mockReset();
  showToast.mockReset();
  resize.mockReset();
});

const renderPage = () =>
  render(
    <PageChromeProvider>
      <MemoryRouter initialEntries={["/c1/settings"]}>
        <Routes>
          <Route path="/:clinicSlug/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </PageChromeProvider>,
  );

const saveBtn = () => screen.getByRole("button", { name: "Save" });

test("prefills fields from branding", () => {
  renderPage();
  expect(screen.getByLabelText("Clinic name")).toHaveValue("Grace Homoeo");
  expect(screen.getByLabelText("Doctor name")).toHaveValue("Dr A");
  expect(
    screen.getByRole("checkbox", { name: "Show scripture banner" }),
  ).toBeChecked();
});

test("choosing a preset updates the preview swatch", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Teal" }));
  expect(screen.getByTestId("colour-preview")).toHaveStyle({
    backgroundColor: "#0f766e",
  });
});

test("a light custom colour shows the readability adjustment", () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Custom colour"), {
    target: { value: "#ffcc00" },
  });
  expect(screen.getByText(/Adjusted for readability/)).toBeInTheDocument();
  expect(screen.getByText(/Adjusted for readability/).textContent).toMatch(
    /#[0-9a-f]{6}/,
  );
});

test("saves the full branding with the signed-in email", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: "Teal" }));
  await user.click(
    screen.getByRole("checkbox", { name: "Show scripture banner" }),
  );
  await user.type(screen.getByLabelText("Phone"), "99");
  await user.click(saveBtn());
  expect(saveMutate).toHaveBeenCalledTimes(1);
  const [vars, opts] = saveMutate.mock.calls[0];
  expect(vars).toEqual({
    branding: {
      ...SAVED,
      primaryColor: "#0f766e",
      showScripture: false,
      contact: { ...SAVED.contact, phone: "99" },
    },
    by: "owner@x.com",
  });
  opts.onSuccess();
  expect(showToast).toHaveBeenCalledWith("Settings saved", "success");
});

test("upload errors are explained", async () => {
  renderPage();
  const input = screen.getByLabelText("Logo file");
  const f = new File(["x"], "a.txt", { type: "text/plain" });
  resize.mockRejectedValueOnce(new Error("not-image"));
  fireEvent.change(input, { target: { files: [f] } });
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith(
      "Choose a PNG, JPG or WebP image.",
      "error",
    ),
  );
  resize.mockRejectedValueOnce(new Error("too-large"));
  fireEvent.change(input, { target: { files: [f] } });
  await waitFor(() =>
    expect(showToast).toHaveBeenCalledWith("That image is too large.", "error"),
  );
});

test("upload then remove logo", async () => {
  const user = userEvent.setup();
  resize.mockResolvedValueOnce("data:image/webp;base64,AAAA");
  renderPage();
  fireEvent.change(screen.getByLabelText("Logo file"), {
    target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
  });
  await user.click(await screen.findByRole("button", { name: "Remove logo" }));
  await user.click(saveBtn());
  expect(saveMutate.mock.calls[0][0].branding.logoDataUrl).toBe("");
});

test("over-long name blocks save", async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Clinic name"), {
    target: { value: "x".repeat(61) },
  });
  expect(
    screen.getByText("Keep the name under 60 characters."),
  ).toBeInTheDocument();
  expect(saveBtn()).toBeDisabled();
});

test("over-long contact field blocks save", () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Address"), {
    target: { value: "x".repeat(121) },
  });
  expect(saveBtn()).toBeDisabled();
});

test("edits made while a logo resizes are kept", async () => {
  let resolve!: (v: string) => void;
  resize.mockReturnValue(new Promise<string>((r) => (resolve = r)));
  const user = userEvent.setup();
  renderPage();
  fireEvent.change(screen.getByLabelText("Logo file"), {
    target: { files: [new File(["x"], "l.png", { type: "image/png" })] },
  });
  await user.clear(screen.getByLabelText("Clinic name"));
  await user.type(screen.getByLabelText("Clinic name"), "New Name");
  resolve("data:image/webp;base64,AAAA");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Remove logo" }),
    ).toBeInTheDocument(),
  );
  await user.click(saveBtn());
  expect(saveMutate.mock.calls[0][0].branding).toMatchObject({
    displayName: "New Name",
    logoDataUrl: "data:image/webp;base64,AAAA",
  });
});

test("shows a retry when settings fail to load", async () => {
  branding.value = undefined;
  branding.isError = true;
  const user = userEvent.setup();
  renderPage();
  expect(
    screen.getByText("Couldn't load settings. Check your connection."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(branding.refetch).toHaveBeenCalled();
});

test("saves updatedBy lowercased", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(saveBtn());
  expect(saveMutate.mock.calls[0][0].by).toBe("owner@x.com");
});
