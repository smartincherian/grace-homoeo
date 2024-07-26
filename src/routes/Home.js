import React from "react";
import image1 from "../assets/image1.jpg";
import "../App.css";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import image from "../assets/logo.png";
import verse from "../assets/verse.jpeg";
import { Typography } from "@mui/material";

function Home() {
  return (
    <Box
      className="App"
      sx={{ flexGrow: 1 }}
      style={{ backgroundImage: `url(${image1})` }}
    >
      {/* <p className="help"> Help Me....God</p> */}
      <Grid container className="grid-box">
        {/* spacing={2} */}
        <Grid item xs={6}>
          <Box
            className="logo-box"
            component="img"
            sx={{
              height: "15vh",
              width: "15vw",
              marginTop: "5vh",
            }}
            alt="Your logo."
            src={image}
          />
        </Grid>
        <Grid item xs={6}>
          <Box
            className="logo-box"
            component="img"
            sx={{
              height: "15vh",
              width: "15vw",
              marginTop: "5vh",
            }}
            alt="Your logo."
            src={verse}
          />
        </Grid>
      </Grid>

      {/* className='ml-[50rem] mr-36 first-box' */}
      <Box class="mx-auto mt-36">
        <Grid container spacing={2}>
          <Box className="border-2 border-indigo-400 mx-auto p-6 px-12 bg-blue-50 rounded-md home-box">
            <Grid item xs={12}>
              <Link to="/patientsManagement">
                <Button className="items-button" variant="contained">
                  Patients Management
                </Button>
              </Link>
            </Grid>
            <Grid item xs={12}>
              <Link to="/inventoryManagement">
                <Button className="items-button" variant="contained">
                  Inventory Management
                </Button>
              </Link>
            </Grid>
            <Grid item xs={12}>
              <Button className="items-button" variant="contained">
                <Link to="/fundManagement">Fund Management</Link>
              </Button>
            </Grid>
          </Box>
        </Grid>
      </Box>

      <Box className="mx-auto mt-28">
        <Typography
          variant="caption"
          align="center"
          style={{ color: "#757575" }}
        >
          All Glory to God For Ever and Ever | Grace InfoTech | ©{" "}
          {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}

export default Home;
