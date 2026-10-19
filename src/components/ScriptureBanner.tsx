import { useEffect, useRef, useState } from "react";
import {
  Box,
  ButtonBase,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { TOKENS } from "../theme/theme";
import SiteFooter from "./SiteFooter";

const VERSES = [
  {
    text: "ഞാന്‍ എന്തായിരിക്കുന്നുവോ അതു ദൈവകൃപയാലാണ്.",
    ref: "1 കൊറിന്തോസ് 15:10",
  },
  {
    text: "എന്നാല്‍, അവിടുന്ന് എന്നോട് അരുളിച്ചെയ്തു: നിനക്ക് എന്റെ കൃപ മതി; എന്തെന്നാല്‍, ബലഹീനതയിലാണ് എന്റെ ശക്തി പൂര്‍ണമായി പ്രകടമാകുന്നത്.",
    ref: "2 കൊറിന്തോസ് 12:9",
  },
];

const SERIF = "'Noto Serif Malayalam', serif";
const GOLD = "#c9962b";
// Night-blue to gold, drawn as a 1.5px gradient border around a pale card.
const FRAME = `linear-gradient(135deg, #1b3aa8, ${TOKENS.blue} 45%, ${GOLD})`;
const ROTATE_MS = 10_000;

function Verse({ text, reference }: { text: string; reference: string }) {
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Typography
        component="blockquote"
        sx={{
          m: 0,
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: { xs: 13.5, md: 14 },
          lineHeight: 1.6,
          color: TOKENS.ink,
        }}
      >
        {text}
        <Box
          component="cite"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            ml: 1,
            fontStyle: "normal",
            fontSize: 11.5,
            fontWeight: 700,
            color: TOKENS.blue700,
            whiteSpace: "nowrap",
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{ width: 14, height: 1.5, bgcolor: GOLD, borderRadius: 1 }}
          />
          {reference}
        </Box>
      </Typography>
    </Box>
  );
}

/**
 * The clinic's verses in a framed card with the copyright line beneath,
 * pinned to the bottom of every page. Wide screens show both verses side by
 * side; phones show one at a time (tap, or every 10s). The verses scroll
 * inside the card if they ever outgrow it. `pinned={false}` lets it sit in
 * normal flow (login page).
 */
export default function ScriptureBanner({
  pinned = true,
}: {
  pinned?: boolean;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [index, setIndex] = useState(0);

  // Publish the block's height as --scripture-h so other bottom-pinned things
  // (add button, form save bar) can sit above it.
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

  useEffect(() => {
    if (isDesktop || reduceMotion) return;
    const t = setInterval(
      () => setIndex((i) => (i + 1) % VERSES.length),
      ROTATE_MS,
    );
    return () => clearInterval(t);
  }, [isDesktop, reduceMotion]);

  const shown = isDesktop ? VERSES : [VERSES[index]];

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
      <Box
        component="aside"
        aria-label="Scripture"
        lang="ml"
        sx={{
          p: "1.5px",
          borderRadius: "16px",
          background: FRAME,
          boxShadow: "0 6px 20px rgba(27,58,168,.12)",
        }}
      >
        <Box
          {...(isDesktop
            ? {}
            : {
                component: ButtonBase,
                onClick: () => setIndex((i) => (i + 1) % VERSES.length),
                "aria-label": "Show the next verse",
              })}
          sx={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            textAlign: "left",
            borderRadius: "14.5px",
            background: `radial-gradient(120% 140% at 0% 0%, ${TOKENS.blue50} 0%, ${TOKENS.white} 55%, #fffaf0 100%)`,
            px: { xs: 1.75, md: 2.5 },
            py: { xs: 1, md: 1.25 },
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              maxHeight: { xs: "22vh", md: "18vh" },
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" },
              columnGap: 3,
              alignItems: "center",
            }}
          >
            {shown.map((v, i) => [
              i > 0 && (
                <Box
                  key={`${v.ref}-rule`}
                  aria-hidden
                  sx={{
                    alignSelf: "stretch",
                    width: "1px",
                    background: `linear-gradient(180deg, transparent, ${TOKENS.blue200}, transparent)`,
                  }}
                />
              ),
              <Verse key={v.ref} text={v.text} reference={v.ref} />,
            ])}
          </Box>
          {!isDesktop && (
            <Box
              aria-hidden
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                flex: "none",
              }}
            >
              {VERSES.map((v, i) => (
                <Box
                  key={v.ref}
                  sx={{
                    width: 6,
                    height: i === index ? 14 : 6,
                    borderRadius: "99px",
                    bgcolor: i === index ? GOLD : TOKENS.blue200,
                    transition: "height .25s ease",
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <SiteFooter />
    </Box>
  );
}
