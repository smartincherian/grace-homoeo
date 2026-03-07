import React, { useState } from "react";
import Header from "../Header";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import { useTheme, useMediaQuery } from "@mui/material";
import PatientAdd from "./PatientAdd";
import PatientSearch from "./PatientSearch";

function PatientManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [addPatientView, setAddPatientView] = useState(false);
  const [searchPatientView, setSearchPatientView] = useState(true);

  const addPatientButtonHandler = () => {
    setAddPatientView((prev) => !prev);
    setSearchPatientView(false);
  };

  const searchPatientButtonHandler = () => {
    setSearchPatientView((prev) => !prev);
    setAddPatientView(false);
  };

  return (
    <div>
      <Header page={"Patient Management"} />

      {/* Conditional rendering of components */}
      <Container maxWidth="lg" sx={{ mt: 11 }}>
        {addPatientView && <PatientAdd />}
        {searchPatientView && <PatientSearch />}
      </Container>
    </div>
  );
}

export default PatientManagement;
