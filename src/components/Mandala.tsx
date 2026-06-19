import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface Props {
  size?: number;
  color?: string;
  opacity?: number;
  sx?: SxProps<Theme>;
}

const RAYS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);

export default function Mandala({ size = 160, color = "currentColor", opacity = 0.2, sx }: Props) {
  return (
    <Box
      component="svg"
      aria-hidden="true"
      role="presentation"
      viewBox="0 0 200 200"
      sx={{ width: size, height: size, color, opacity, pointerEvents: "none", ...sx }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.4}>
        <circle cx={100} cy={100} r={94} />
        <circle cx={100} cy={100} r={70} />
        <circle cx={100} cy={100} r={46} />
        {RAYS.map((a) => (
          <line key={a} x1={100} y1={30} x2={100} y2={54} transform={`rotate(${a} 100 100)`} />
        ))}
        {PETALS.map((a) => (
          <path
            key={a}
            d="M100 54 C120 70 120 100 100 100 C80 100 80 70 100 54 Z"
            transform={`rotate(${a} 100 100)`}
          />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <line x1={100} y1={88} x2={100} y2={112} />
        <line x1={88} y1={100} x2={112} y2={100} />
      </g>
    </Box>
  );
}
