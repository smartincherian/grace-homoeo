import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import ScriptureBanner from "./ScriptureBanner";
import SiteFooter from "./SiteFooter";

/**
 * Bottom block of every page: the optional scripture card, then the credit
 * footer (always shown). When pinned it sticks to the bottom (above the tab
 * bar on phones) and publishes its height as --scripture-h so other
 * bottom-pinned things can sit above it. `pinned={false}` sits in flow.
 */
export default function BottomDock({
  pinned = true,
  showScripture = true,
}: {
  pinned?: boolean;
  showScripture?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!pinned || !el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() =>
      root.style.setProperty("--scripture-h", `${el.offsetHeight}px`),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--scripture-h");
    };
  }, [pinned]);

  return (
    <Box
      ref={ref}
      sx={{
        position: pinned ? "sticky" : "relative",
        // Phones: sit right on top of the bottom tab bar.
        bottom: pinned
          ? { xs: "calc(56px + env(safe-area-inset-bottom))", md: 0 }
          : undefined,
        zIndex: 2,
        mt: 2,
        pt: 1,
        pb: { xs: 0.5, md: 0 },
        // Page ground behind the card so scrolled content doesn't show
        // through the gaps around it.
        bgcolor: pinned ? "background.default" : undefined,
      }}
    >
      {showScripture && <ScriptureBanner />}
      <SiteFooter />
    </Box>
  );
}
