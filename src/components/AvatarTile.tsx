import { Box } from "@mui/material";
import { TOKENS, avatarColors, initials } from "../theme/theme";

/** Rounded-square initials tile; `solid` uses the blue accent. */
export default function AvatarTile({
  name,
  seed = 0,
  size = 38,
  solid,
}: {
  name: string;
  seed?: number;
  size?: number;
  solid?: boolean;
}) {
  const [bg, fg] = solid ? [TOKENS.blue, TOKENS.white] : avatarColors(seed);
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: `${Math.round(size * 0.31)}px`,
        bgcolor: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        fontWeight: solid ? 800 : 700,
        fontSize: Math.round(size * 0.34),
      }}
    >
      {initials(name)}
    </Box>
  );
}
