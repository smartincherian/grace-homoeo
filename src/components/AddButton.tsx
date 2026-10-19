import { Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "react-router-dom";

export default function AddButton({
  label,
  to,
}: {
  label: string;
  to: string;
}) {
  return (
    <Fab
      variant="extended"
      color="primary"
      component={Link}
      to={to}
      aria-label={label}
      sx={{
        position: "fixed",
        // Above the bottom tab bar and the pinned scripture bar.
        bottom: {
          xs: "calc(84px + var(--scripture-h, 0px) + env(safe-area-inset-bottom))",
          md: "calc(40px + var(--scripture-h, 0px))",
        },
        right: { xs: 16, md: 32 },
        fontWeight: 700,
      }}
    >
      <AddIcon sx={{ mr: 1 }} />
      {label}
    </Fab>
  );
}
