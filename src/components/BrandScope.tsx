import { useEffect, useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../theme/theme";
import { DEFAULT_BRAND, brandCssVars, derivePalette } from "../theme/brand";
import { displayNameOf } from "../lib/branding";
import { useBranding } from "../lib/useBranding";
import { useClinic } from "../lib/clinicQueries";

const DEFAULT_VARS = brandCssVars(derivePalette(DEFAULT_BRAND));

function applyVars(vars: Record<string, string>) {
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) style.setProperty(k, v);
}

/**
 * Applies a clinic's colour (CSS variables + MUI theme) and browser title to
 * everything inside. With no clinic, or on unmount, Grace Medica defaults return.
 */
export default function BrandScope({
  clinicId,
  children,
}: {
  clinicId: string | undefined;
  children: ReactNode;
}) {
  const branding = useBranding(clinicId).data;
  const clinicName = useClinic(clinicId).data?.name;
  const color = clinicId ? branding?.primaryColor : undefined;
  const theme = useMemo(() => buildTheme(color), [color]);
  const title = clinicId
    ? `${displayNameOf(branding, clinicName)} · Grace Medica`
    : "Grace Medica";

  useEffect(() => {
    applyVars(color ? brandCssVars(derivePalette(color)) : DEFAULT_VARS);
  }, [color]);
  useEffect(
    () => () => {
      applyVars(DEFAULT_VARS);
      document.title = "Grace Medica";
    },
    [],
  );
  useEffect(() => {
    document.title = title;
  }, [title]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
