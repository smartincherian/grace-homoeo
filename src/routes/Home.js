import React from "react";
import image1 from "../assets/image1.jpg";
import "../App.css";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import image from "../assets/logo.png";
import verse from "../assets/verse.jpeg";
import { Typography, useMediaQuery, useTheme } from "@mui/material";
import Container from "@mui/material/Container";

function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  return (
    <Box
      className="App"
      sx={{
        flexGrow: 1,
        backgroundImage: `url(${image1})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Container maxWidth="lg" sx={{ flexGrow: 1 }}>
        {/* Header with logos */}
        <Grid
          container
          spacing={isMobile ? 2 : 4}
          justifyContent="center"
          alignItems="center"
          sx={{ mt: isMobile ? 2 : 5 }}
        >
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ textAlign: isMobile ? "center" : "left" }}
          >
            <Box
              component="img"
              sx={{
                height: isMobile ? "10vh" : "15vh",
                width: isMobile ? "auto" : "15vw",
                maxWidth: "100%",
              }}
              alt="Your logo."
              src={image}
            />
          </Grid>
          <Grid
            item
            xs={12}
            sm={6}
            sx={{ textAlign: isMobile ? "center" : "right" }}
          >
            <Box
              component="img"
              sx={{
                height: isMobile ? "10vh" : "15vh",
                width: isMobile ? "auto" : "15vw",
                maxWidth: "100%",
              }}
              alt="Verse logo."
              src={verse}
            />
          </Grid>
        </Grid>

        {/* Main content */}
        <Box
          sx={{
            mt: isMobile ? 8 : isTablet ? 12 : 16,
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Box
            sx={{
              border: "2px solid #818cf8",
              borderRadius: "8px",
              padding: isMobile ? 3 : 6,
              backgroundColor: "rgba(239, 246, 255, 0.9)",
              width: isMobile ? "90%" : isTablet ? "70%" : "50%",
              maxWidth: "500px",
            }}
          >
            <Grid container spacing={3} direction="column">
              <Grid item xs={12}>
                <Link
                  to="/patientsManagement"
                  style={{
                    textDecoration: "none",
                    width: "100%",
                    display: "block",
                  }}
                >
                  <Button
                    variant="contained"
                    fullWidth
                    size={isMobile ? "medium" : "large"}
                    sx={{
                      padding: isMobile ? "10px 16px" : "12px 24px",
                      fontSize: isMobile ? "0.9rem" : "1rem",
                    }}
                  >
                    Patients Management
                  </Button>
                </Link>
              </Grid>
              <Grid item xs={12}>
                <Link
                  to="/inventoryManagement"
                  style={{
                    textDecoration: "none",
                    width: "100%",
                    display: "block",
                  }}
                >
                  <Button
                    variant="contained"
                    fullWidth
                    size={isMobile ? "medium" : "large"}
                    sx={{
                      padding: isMobile ? "10px 16px" : "12px 24px",
                      fontSize: isMobile ? "0.9rem" : "1rem",
                    }}
                  >
                    Inventory Management
                  </Button>
                </Link>
              </Grid>
              <Grid item xs={12}>
                <Link
                  to="/fundManagement"
                  style={{
                    textDecoration: "none",
                    width: "100%",
                    display: "block",
                  }}
                >
                  <Button
                    variant="contained"
                    fullWidth
                    size={isMobile ? "medium" : "large"}
                    sx={{
                      padding: isMobile ? "10px 16px" : "12px 24px",
                      fontSize: isMobile ? "0.9rem" : "1rem",
                    }}
                  >
                    Fund Management
                  </Button>
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          mt: "auto",
          mb: 3,
          width: "100%",
          textAlign: "center",
        }}
      >
        <Typography
          variant="caption"
          align="center"
          style={{
            color: "#757575",
            fontSize: isMobile ? "0.7rem" : "0.8rem",
          }}
        >
          All Glory to God For Ever and Ever | Grace InfoTech | ©{" "}
          {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}

export default Home;
