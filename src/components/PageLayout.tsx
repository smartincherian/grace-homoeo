import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/** Page title with an optional summary line and actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "stretch", md: "center" },
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        mb: 2.5,
      }}
    >
      <Box sx={{ minWidth: 0, mr: { md: "auto" } }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 26, md: 30 } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>{actions}</Box>
      )}
    </Box>
  );
}

/** Centred column for forms and single-item pages. */
export function PageColumn({
  children,
  maxWidth = 640,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return <Box sx={{ position: "relative", maxWidth, mx: "auto" }}>{children}</Box>;
}
