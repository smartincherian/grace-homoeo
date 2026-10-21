import { renderHook } from "@testing-library/react";
import { vi } from "vitest";

const auth = vi.hoisted(() => ({ currentUser: null as { uid: string } | null }));
vi.mock("../../lib/firebase", () => ({ auth }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: () => () => {} }));

import { useAuth } from "./useAuth";

it("starts from the already signed-in user on first render", () => {
  auth.currentUser = { uid: "u1" };
  const { result } = renderHook(() => useAuth());
  expect(result.current).toEqual({ user: { uid: "u1" }, loading: false });
});

it("is loading until auth reports when nobody is signed in yet", () => {
  auth.currentUser = null;
  const { result } = renderHook(() => useAuth());
  expect(result.current).toEqual({ user: null, loading: true });
});
