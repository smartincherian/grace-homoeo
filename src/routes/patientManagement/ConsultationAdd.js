import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Box,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  InputAdornment,
  Card,
  CardContent,
  CardHeader,
  FormHelperText,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EventNoteIcon from "@mui/icons-material/EventNote";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNavigate } from "react-router-dom";
import Header from "../Header";
import { fetchPatients } from "../../firestore/patient";
import { addConsultation } from "../../firestore/consultation";

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#f50057",
    },
    background: {
      default: "#f5f5f5",
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        fullWidth: true,
        size: "medium",
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 4px 20px 0 rgba(0,0,0,0.1)",
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          backgroundColor: "#1976d2",
          color: "#fff",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
});

const VALIDATION_ERRORS = {
  REQUIRED: "This field is required",
};

function ConsultationAdd() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    complaint: "",
    generals: "",
    allergy: "",
    history: "",
    remedy: "",
    remarks: "",
    date: dayjs(),
    amount: "",
    patientId: "",
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const [allPatients, setAllPatients] = useState([]);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [patient, setPatient] = useState({});

  useEffect(() => {
    fetchAllPatients();
  }, []);

  const fetchAllPatients = async () => {
    const response = await fetchPatients();
    setAllPatients(response);
  };

  const handleInputChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });

    // Clear error for this field when user types
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: null,
      });
    }
  };

  const handleDateChange = (date) => {
    setFormData({
      ...formData,
      date,
    });

    // Clear date error
    if (errors.date) {
      setErrors({
        ...errors,
        date: null,
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.complaint) newErrors.complaint = VALIDATION_ERRORS.REQUIRED;
    if (!formData.remedy) newErrors.remedy = VALIDATION_ERRORS.REQUIRED;
    if (!formData.date) newErrors.date = VALIDATION_ERRORS.REQUIRED;
    if (!formData.amount) newErrors.amount = VALIDATION_ERRORS.REQUIRED;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSavePatient = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const payload = {
        ...formData,
        date: formData.date.valueOf(),
      };
      await addConsultation(payload);
      alert("Consultation added successfully");
      navigate("/patientsManagement");
    } catch (error) {
      console.error("Error saving patient:", error);
      alert("Failed to save patient");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}
      >
        <Header page={"Patient Management - Add New Consultation"} />

        <Container maxWidth="md" sx={{ py: 4, mt: 11 }}>
          <Card>
            <CardHeader
              title="Patient Consultation Form"
              subheader="Enter patient details below"
            />
            <CardContent>
              <Box sx={{ p: 2 }}>
                <Grid container spacing={3}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Autocomplete
                        options={allPatients}
                        getOptionLabel={(option) =>
                          `${option.name} [${option.ID}]`
                        } // Display name and readable ID
                        value={
                          allPatients.find(
                            (p) => p.id === formData.patientId
                          ) || null
                        }
                        onChange={(event, newValue) => {
                          setFormData({
                            ...formData,
                            patientId: newValue ? newValue.id : "", // Save backend ID only
                          });
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Patient"
                            variant="filled"
                            fullWidth
                          />
                        )}
                        isOptionEqualToValue={(option, value) =>
                          option.id === value.id
                        }
                      />
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Present Complaint"
                      required
                      multiline
                      rows={3}
                      value={formData.complaint}
                      onChange={handleInputChange("complaint")}
                      error={!!errors.complaint}
                      helperText={errors.complaint}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <MedicalServicesIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Generals"
                      multiline
                      rows={2}
                      value={formData.generals}
                      onChange={handleInputChange("generals")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Allergy"
                      multiline
                      rows={2}
                      value={formData.allergy}
                      onChange={handleInputChange("allergy")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="History"
                      multiline
                      rows={2}
                      value={formData.history}
                      onChange={handleInputChange("history")}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Prescribed Remedy"
                      required
                      multiline
                      rows={3}
                      value={formData.remedy}
                      onChange={handleInputChange("remedy")}
                      error={!!errors.remedy}
                      helperText={errors.remedy}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <DescriptionIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Remarks"
                      multiline
                      rows={2}
                      value={formData.remarks}
                      onChange={handleInputChange("remarks")}
                    />
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DatePicker
                        label="Date of Consultation"
                        value={formData.date}
                        onChange={handleDateChange}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            required
                            error={!!errors.date}
                            helperText={errors.date}
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <EventNoteIcon color="primary" />
                                </InputAdornment>
                              ),
                            }}
                          />
                        )}
                      />
                    </LocalizationProvider>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Amount Collected"
                      required
                      type="number"
                      value={formData.amount}
                      onChange={handleInputChange("amount")}
                      error={!!errors.amount}
                      helperText={errors.amount}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography color="primary" fontWeight="bold">
                              ₹
                            </Typography>{" "}
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel id="payment-mode-label">
                        Payment Mode
                      </InputLabel>
                      <Select
                        labelId="payment-mode-label"
                        value={formData.paymentMode}
                        onChange={handleInputChange("paymentMode")}
                        label="Payment Mode"
                      >
                        <MenuItem value="Cash">Cash</MenuItem>
                        <MenuItem value="UPI">UPI</MenuItem>
                        <MenuItem value="No Fees">No Fees</MenuItem>
                        <MenuItem value="Debt">Debt</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box
                  sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}
                >
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => navigate(-1)}
                    sx={{ mr: 2 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={isLoading ? null : <SaveIcon />}
                    onClick={handleSavePatient}
                    disabled={isLoading}
                    sx={{ minWidth: 120 }}
                  >
                    {isLoading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default ConsultationAdd;
