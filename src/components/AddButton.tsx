import { Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "react-router-dom";

export default function AddButton({ label, to }: { label: string; to: string }) {
  return (
    <Fab
      variant="extended"
      color="primary"
      component={Link}
      to={to}
      aria-label={label}
      sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24, fontWeight: 700 }}
    >
      <AddIcon sx={{ mr: 1 }} />
      {label}
    </Fab>
  );
}
