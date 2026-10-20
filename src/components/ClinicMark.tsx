import { Box } from "@mui/material";
import { GRADIENT } from "../theme/theme";
import type { Branding } from "../lib/branding";

/** A clinic's logo, or an initial-letter tile in the brand gradient. */
export default function ClinicMark({
  branding,
  name,
  size = 36,
  decorative = false,
}: {
  branding: Pick<Branding, "logoDataUrl"> | undefined;
  name: string;
  size?: number;
  /** Hide from assistive tech when the name is printed beside it. */
  decorative?: boolean;
}) {
  const radius = `${Math.round(size * 0.3)}px`;
  if (branding?.logoDataUrl) {
    return (
      <Box
        component="img"
        src={branding.logoDataUrl}
        alt={decorative ? "" : name}
        sx={{
          width: size,
          height: size,
          flex: "none",
          borderRadius: radius,
          objectFit: "contain",
        }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: radius,
        background: GRADIENT,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: size * 0.44,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </Box>
  );
}
