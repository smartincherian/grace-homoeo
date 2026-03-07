import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Card,
  CardContent,
  Checkbox,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useContext } from "react";
import {
  SNACK_BAR_SEVERITY_TYPES,
  SnackbarContext,
} from "../../components/Snackbar";
import biblePlanData from "../../assets/biy-helper/biy-plan.json";
import QuoteCarousel from "../../components/Carousel";
import { inspiringQoutes } from "../../common/constants";
import bookNames from "../../locales/english.json";
import useLocalization from "../../hooks/useLocalization";
import { periodColors } from "./helpers";

const BIBLE_PLAN = biblePlanData;

export default function BibleReadingPlan() {
  const [name, setname] = useState("");
  const [enteredname, setEnteredname] = useState(false);
  const [completedDays, setCompletedDays] = useState([]);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startDay, setStartDay] = useState(1);
  const { showSnackbar } = useContext(SnackbarContext);
  const dayRefs = useRef({});
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [completionVerse, setCompletionVerse] = useState(null);
  const [encouragement, setEncouragement] = useState(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const { translate, currentLanguage, switchLanguage } = useLocalization();

  const storageKey = (name) =>
    `bible-plan-${name.trim().toLowerCase().replace(/\s+/g, "-")}`;

  useEffect(() => {
    const storedname = localStorage.getItem("bible-reading-name");
    if (storedname) {
      setname(storedname);
      setEnteredname(true);
    }
  }, []);

  useEffect(() => {
    if (name) {
      const saved = localStorage.getItem(storageKey(name));
      if (saved) {
        setCompletedDays(JSON.parse(saved));
      } else {
        setStartDialogOpen(true);
      }
    }
  }, [name, enteredname]);

  const scrollToDay = (day) => {
    const ref = dayRefs.current[day];
    if (ref && ref.scrollIntoView) {
      ref.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    if (name && completedDays.length > 0) {
      const nextDay = Math.min(completedDays.length + 1, BIBLE_PLAN.length);
      setTimeout(() => scrollToDay(nextDay), 300); // allow time for UI to render
    }
  }, [name, completedDays]);

  const handleStart = () => {
    const initialCompleted = [];
    for (let i = 1; i < startDay; i++) {
      initialCompleted.push(i);
    }
    setCompletedDays(initialCompleted);
    localStorage.setItem(storageKey(name), JSON.stringify(initialCompleted));
    setStartDialogOpen(false);
    showSnackbar(
      "Progress initialized. God bless your journey!",
      SNACK_BAR_SEVERITY_TYPES.SUCCESS
    );
  };

  const markDayComplete = (day) => {
    if (!completedDays.includes(day)) {
      const updated = [...completedDays, day];
      setCompletedDays(updated);
      localStorage.setItem(storageKey(name), JSON.stringify(updated));
      showSnackbar(
        `Day ${day} completed! Well done! 🙌`,
        SNACK_BAR_SEVERITY_TYPES.SUCCESS
      );
      const highlight = BIBLE_PLAN.find((d) => d.day === day)?.highlightVerse;
      if (highlight) {
        setCompletionVerse(highlight);
        setCompletionOpen(true);
      }
      const encouragement = BIBLE_PLAN.find(
        (d) => d.day === day
      )?.encouragement;
      if (encouragement) {
        setEncouragement(encouragement);
      }
    }
  };

  const isDayUnlocked = (day) => {
    return day === 1 || completedDays.includes(day - 1);
  };

  const progress = Math.floor((completedDays.length / BIBLE_PLAN.length) * 100);

  if (!enteredname) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Container
          maxWidth="md"
          sx={{
            maxHeight: "80vh",
            overflowY: "auto",
            scrollBehavior: "smooth",
            textAlign: "center", // optional, for center-aligning content
          }}
        >
          <Typography variant="h5" gutterBottom>
            Start Your Bible Reading Journey Today
          </Typography>
          <QuoteCarousel quotes={inspiringQoutes} interval={10000} />
          <Box
            display="flex"
            flexDirection={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="flex-start"
            gap={2}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Enter your name"
              variant="outlined"
              onChange={(e) => setname(e.target.value)}
              sx={{ width: { xs: "100%", sm: 300 } }}
            />

            <TextField
              select
              label="Language"
              value={currentLanguage}
              onChange={(e) => switchLanguage(e.target.value)}
              sx={{ width: { xs: "100%", sm: 200 } }}
            >
              <MenuItem value="english">English</MenuItem>
              <MenuItem value="malayalam">മലയാളം</MenuItem>
            </TextField>
          </Box>

          <Box mt={2}>
            <Button
              variant="contained"
              disabled={!name}
              onClick={() => {
                localStorage.setItem("bible-reading-name", name);
                setEnteredname(true);
              }}
            >
              Continue
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  const getYouTubeVideoId = (url) => {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\s&]+)/
    );
    return match ? match[1] : "";
  };

  return (
    <Container
      maxWidth="md"
      sx={{ maxHeight: "80vh", overflowY: "auto", scrollBehavior: "smooth" }}
    >
      <Typography variant="h4" gutterBottom>
        📖 Daily Bible Reading Plan
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Welcome, {name}
      </Typography>

      <Box sx={{ my: 2 }}>
        <LinearProgress variant="determinate" value={progress} />
        <Typography variant="body2" align="right">
          {progress}% completed
        </Typography>
      </Box>

      <Button
        variant="outlined"
        onClick={() => setShowAllCompleted(!showAllCompleted)}
        sx={{ mb: 2 }}
      >
        {showAllCompleted ? "Hide Completed" : "Show All Completed"}
      </Button>

      <Button
        variant="outlined"
        color="warning"
        sx={{ mb: 2, ml: 2 }}
        onClick={() => {
          if (window.confirm("Are you sure you want to reset your progress?")) {
            setCompletedDays([]);
            localStorage.removeItem(storageKey(name));
            localStorage.removeItem("bible-reading-name");
            setEnteredname(false);
            showSnackbar(
              "Progress has been reset.",
              SNACK_BAR_SEVERITY_TYPES.INFO
            );
          }
        }}
      >
        Reset
      </Button>
      <QuoteCarousel quotes={inspiringQoutes} interval={10000} />

      {BIBLE_PLAN.filter(({ day }) => {
        const done = completedDays.includes(day);
        const unlocked = isDayUnlocked(day);

        if (!unlocked) return false;

        // Show uncompleted days always
        if (!done) return true;

        // If showing all completed, show them
        if (showAllCompleted) return true;

        // Show only the last 3 completed by default
        const lastCompleted = completedDays
          .slice()
          .sort((a, b) => b - a) // Descending
          .slice(0, 3);
        return lastCompleted.includes(day);
      }).map(({ day, period, readings, yt_mal }) => {
        const done = completedDays.includes(day);

        return (
          <Card
            key={day}
            ref={(el) => (dayRefs.current[day] = el)}
            sx={{
              mb: 3,
              boxShadow: 3,
              borderRadius: 2,
              backgroundColor: done ? "#f0fdf4" : "#ffffff",
              borderLeft: `8px solid ${periodColors[period] || "#ccc"}`,
              transition: "all 0.3s ease",
              "&:hover": {
                boxShadow: 6,
                transform: "scale(1.01)",
              },
            }}
          >
            <CardContent>
              <Box
                display="flex"
                flexDirection={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "flex-start" }}
                flexWrap="wrap"
              >
                {/* Header Row: Checkbox */}
                <Box
                  display="flex"
                  justifyContent={{ xs: "center", sm: "flex-end" }}
                  alignItems="center"
                  sx={{ width: "100%", mb: { xs: 2, sm: 0 } }}
                >
                  {done ? (
                    <CheckCircleIcon sx={{ color: "green", fontSize: 40 }} />
                  ) : (
                    <Checkbox
                      onChange={() => markDayComplete(day)}
                      size="large"
                      sx={{
                        transform: "scale(1.4)",
                        color: "primary.main",
                      }}
                    />
                  )}
                </Box>

                {/* Left Section: Text */}
                <Box flex={1} minWidth={250} sx={{ mb: { xs: 2, sm: 0 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: periodColors[period] || "text.primary",
                      mb: 1,
                    }}
                  >
                    {translate("day")} {day}: {translate(period)}
                  </Typography>

                  <Box sx={{ pl: 1 }}>
                    {readings.map((r, idx) => (
                      <Typography
                        key={idx}
                        variant="body1"
                        sx={{
                          fontSize: "1.1rem",
                          fontWeight: 600,
                          lineHeight: 1.6,
                          mb: 0.5,
                        }}
                      >
                        📖 {translate(r.book)} {r.chapters}
                        {r.verses ? `:${r.verses}` : ""}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                {/* YouTube Thumbnail */}
                {yt_mal && currentLanguage === "malayalam" && (
                  <Box
                    display="flex"
                    justifyContent={{ xs: "center", sm: "flex-start" }}
                    sx={{ mt: { xs: 2, sm: 0 } }}
                  >
                    <a
                      href={yt_mal}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <Box
                        component="img"
                        src={`https://img.youtube.com/vi/${getYouTubeVideoId(
                          yt_mal
                        )}/hqdefault.jpg`}
                        alt="Watch video"
                        sx={{
                          width: 160,
                          height: "auto",
                          borderRadius: 2,
                          boxShadow: 2,
                          transition: "transform 0.2s ease",
                          "&:hover": {
                            transform: "scale(1.03)",
                          },
                        }}
                      />
                    </a>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog to start from a specific day */}
      <Dialog open={startDialogOpen}>
        <DialogTitle>Start your reading journey</DialogTitle>
        <DialogContent>
          <Typography>
            Would you like to start from today (Day 1) or another day?
          </Typography>
          <TextField
            type="number"
            label="Start from Day"
            value={startDay}
            onChange={(e) => setStartDay(parseInt(e.target.value))}
            fullWidth
            sx={{ mt: 2 }}
            inputProps={{ min: 1, max: 365 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleStart} variant="contained">
            Start
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog to complete a specific day */}
      <Dialog open={completionOpen} onClose={() => setCompletionOpen(false)}>
        <DialogTitle>🎉 Well Done! {name}</DialogTitle>
        <DialogContent sx={{ px: 3, py: 2 }}>
          {completionVerse && (
            <>
              <Typography
                variant="subtitle2"
                color="primary"
                fontWeight="bold"
                gutterBottom
                sx={{
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {completionVerse.reference}
              </Typography>

              <Typography
                variant="body1"
                fontWeight={600}
                color="text.primary"
                sx={{
                  fontSize: "1.15rem",
                  lineHeight: 1.7,
                  fontStyle: "italic",
                }}
              >
                “{completionVerse.text}”
              </Typography>
            </>
          )}

          <Typography
            variant="body2"
            sx={{
              mt: 3,
              fontSize: "1rem",
              color: "text.secondary",
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            {encouragement
              ? encouragement
              : "Keep walking with God — you're doing great!"}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setCompletionOpen(false)} variant="contained">
            Amen 🙏
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
