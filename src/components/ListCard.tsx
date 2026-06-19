import { Box, Card, CardActionArea, Stack } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  avatar?: ReactNode;
  edgeColor?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  menu?: ReactNode;
  onClick?: () => void;
}

export default function ListCard({
  avatar,
  edgeColor,
  primary,
  secondary,
  trailing,
  menu,
  onClick,
}: Props) {
  const inner = (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{ px: 1.5, py: 1.25, width: "100%" }}
    >
      {avatar}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            fontWeight: 600,
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
      {trailing}
      {menu}
    </Stack>
  );
  return (
    <Card
      sx={{
        mb: 1,
        borderLeft: edgeColor ? `3px solid ${edgeColor}` : undefined,
        overflow: "hidden",
      }}
    >
      {onClick ? (
        <CardActionArea onClick={onClick}>{inner}</CardActionArea>
      ) : (
        inner
      )}
    </Card>
  );
}
