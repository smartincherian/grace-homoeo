import { createContext, useContext } from "react";

export type Severity = "success" | "error" | "info" | "warning";

export interface ToastContextValue {
  showToast: (message: string, severity?: Severity) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
