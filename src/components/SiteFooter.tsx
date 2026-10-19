import { Box, Link, Typography } from "@mui/material";
import { TOKENS } from "../theme/theme";

const GOLD = "#c9962b";
const DEVELOPER_URL = "https://graceissufficient.net";

/** One-line copyright and credit, under the scripture card. */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <Typography
      component="footer"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        columnGap: 1,
        pt: 0.75,
        fontSize: 11.5,
        lineHeight: 1.5,
        color: TOKENS.faint,
        textAlign: "center",
      }}
    >
      <span>© {year} All rights reserved.</span>
      <Box component="span" aria-hidden sx={{ color: GOLD, fontSize: 9 }}>
        ✦
      </Box>
      <span>
        Developed by{" "}
        <Link
          href={DEVELOPER_URL}
          target="_blank"
          rel="noopener noreferrer"
          underline="none"
          sx={{
            fontWeight: 700,
            background: `linear-gradient(90deg, ${TOKENS.blue700}, ${TOKENS.blue} 60%, ${GOLD})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            borderBottom: `1px dashed ${TOKENS.blue200}`,
            transition: "border-color .2s ease",
            "&:hover": { borderBottomColor: GOLD },
          }}
        >
          graceissufficient.net
        </Link>
      </span>
    </Typography>
  );
}
