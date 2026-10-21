import { Box } from "@mui/material";
import { GRADIENT } from "../theme/theme";

/** The ClinicDesk mark: a gradient rounded square with a white plus and dot. */
export default function ProductMark({ size = 44 }: { size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "22%",
        background: GRADIENT,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: "100%", height: "100%" }}
      >
        <rect x="27" y="14" width="10" height="36" rx="4" fill="#fff" />
        <rect x="14" y="27" width="36" height="10" rx="4" fill="#fff" />
        <circle cx="48" cy="16" r="4" fill="#fff" opacity=".7" />
      </Box>
    </Box>
  );
}
