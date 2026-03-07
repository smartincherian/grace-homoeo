// components/QuoteCarousel.js
import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

const QuoteCarousel = ({ quotes, interval = 60000 }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % quotes.length);
    }, interval);
    return () => clearInterval(id);
  }, [quotes, interval]);

  return (
    <Box sx={{ minHeight: 100, mt: 2 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6 }}
        >
          <Typography
            variant="subtitle1"
            color="text.secondary"
            align="center"
            sx={{ fontStyle: "italic", px: 2 }}
          >
            “{quotes[index]}”
          </Typography>
        </motion.div>
      </AnimatePresence>
    </Box>
  );
};

export default QuoteCarousel;
