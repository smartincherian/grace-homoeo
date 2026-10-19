import { Box, ButtonBase, Stack } from "@mui/material";
import type { ReactNode } from "react";
import { CARD_SX } from "../theme/theme";

interface Props {
  avatar?: ReactNode;
  edgeColor?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  menu?: ReactNode;
  onClick?: () => void;
}

/** One white rounded row in a list; optional coloured edge on the left. */
export default function ListCard({
  avatar,
  edgeColor,
  primary,
  secondary,
  trailing,
  menu,
  onClick,
}: Props) {
  const body = (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ py: 1.5, px: 2, flex: 1, minWidth: 0, textAlign: "left" }}
    >
      {avatar}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            fontWeight: 700,
            fontSize: 15,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {primary}
        </Box>
        {secondary && (
          <Box sx={{ color: "text.secondary", fontSize: 13, mt: 0.25 }}>
            {secondary}
          </Box>
        )}
      </Box>
    </Stack>
  );
  return (
    <Box
      sx={{
        ...CARD_SX,
        borderRadius: "16px",
        mb: 1,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        boxShadow: edgeColor ? `inset 4px 0 0 ${edgeColor}` : undefined,
        "&:hover": onClick ? { bgcolor: "action.hover" } : undefined,
      }}
    >
      {onClick ? (
        <ButtonBase
          onClick={onClick}
          sx={{ flex: 1, minWidth: 0, display: "flex", font: "inherit" }}
        >
          {body}
        </ButtonBase>
      ) : (
        body
      )}
      {(trailing || menu) && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ pr: 1.5 }}>
          {trailing}
          {menu}
        </Stack>
      )}
    </Box>
  );
}
