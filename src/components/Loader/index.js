import { CircularProgress } from "@mui/material";
import React from "react";

export const Loader = ({
  width = "25px",
  height = "25px",
  color = "white",
}) => {
  return (
    <CircularProgress size={"small"} sx={{ width, height, color: { color } }} />
  );
};
