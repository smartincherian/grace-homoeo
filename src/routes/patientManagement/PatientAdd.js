import React, { useState, useEffect, useContext } from "react";
import Header from "../Header";
import { useTheme, useMediaQuery } from "@mui/material";
import {
  Paper,
  Button,
  FormHelperText,
  MenuItem,
  TextField,
  Select,
  Box,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Divider,
  Stack,
  InputAdornment,
  Chip,
  IconButton,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import BadgeIcon from "@mui/icons-material/Badge";
import CakeIcon from "@mui/icons-material/Cake";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WcIcon from "@mui/icons-material/Wc";
import "./PatientsManagement.css";
import moment from "moment";
import {
  addPatient,
  fetchPatientsHighestSerialNumber,
} from "../../firestore/patient";
import {
  SNACK_BAR_POSITIONS,
  SNACK_BAR_SEVERITY_TYPES,
  SnackbarContext,
} from "../../components/Snackbar";
import { Loader } from "../../components/Loader";
import { Controller, useForm } from "react-hook-form";
import { VALIDATION_ERRORS } from "../../common/constants";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { removeUndefined } from "../../common/helpers";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

function PatientAdd() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const [isLoading, setIsLoading] = useState(false);
  const { showSnackbar } = useContext(SnackbarContext);
  const navigate = useNavigate();

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    defaultValues: {},
  });

  const saveButtonHandler = async (data) => {
    setIsLoading(true);
    if (data?.date) {
      const timestamp = dayjs(data?.date).valueOf();
      data.date = timestamp;
    }
    const payload = removeUndefined(data);
    await addPatient({ ...payload });
    showSnackbar(
      "Patient added successfully",
      SNACK_BAR_SEVERITY_TYPES.SUCCESS,
      SNACK_BAR_POSITIONS.TOP_RIGHT
    );
    setIsLoading(false);
    reset({});
    navigate("/patientsSearch");
  };

  const fetchHighestSerialNo = async () => {
    const existingHighestID = await fetchPatientsHighestSerialNumber();
    const nextID = existingHighestID + 1;
    setValue("ID", nextID);
  };

  useEffect(() => {
    fetchHighestSerialNo();
  }, []);

  return (
    <div>
      <Header page={"Patient Management - Add New Patient"} />
      <Container
        maxWidth="lg"
        sx={{
          mt: isMobile ? 8 : 10,
          mb: 4,
          pt: isMobile ? 1 : 2,
        }}
      >
        <Card
          elevation={3}
          sx={{
            borderRadius: 2,
            overflow: "visible",
            position: "relative",
            bgcolor: "#ffffff",
            border: "1px solid #e0e0e0",
          }}
        >
          {/* Header chip */}
          <Box
            sx={{
              position: "absolute",
              top: -20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
            }}
          >
            <Chip
              icon={<PersonAddIcon />}
              label="New Patient Registration"
              color="primary"
              sx={{
                fontWeight: "bold",
                fontSize: isMobile ? "0.9rem" : "1rem",
                py: 2.5,
                boxShadow: 2,
              }}
            />
          </Box>

          <CardContent sx={{ p: isMobile ? 2 : 4, pt: 4, mt: 1 }}>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              align="center"
              color="primary.dark"
              sx={{
                fontWeight: 600,
                mb: 3,
                mt: 1,
              }}
            >
              Patient Information
            </Typography>

            <Divider sx={{ mb: 4 }} />

            <form onSubmit={handleSubmit(saveButtonHandler)}>
              <Grid container spacing={isMobile ? 2 : 3}>
                {/* Patient ID */}
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{ mb: 1, display: "flex", alignItems: "center" }}
                    >
                      <BadgeIcon fontSize="small" sx={{ mr: 1 }} /> Patient ID
                    </FormLabel>
                    <Controller
                      control={control}
                      name={"ID"}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          fullWidth
                          disabled
                          value={value}
                          variant="outlined"
                          InputProps={{
                            readOnly: true,
                            sx: {
                              bgcolor: "rgba(255, 235, 180, 0.5)",
                              fontWeight: "bold",
                              color: theme.palette.primary.dark,
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: theme.palette.primary.main,
                              },
                            },
                          }}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* Name */}
                <Grid item xs={12} sm={6} md={8}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{
                        mb: 1,
                        display: "flex",
                        alignItems: "center",
                        color: errors?.name ? "error.main" : "inherit",
                      }}
                    >
                      <PersonAddIcon fontSize="small" sx={{ mr: 1 }} /> Name of
                      the Patient*
                    </FormLabel>
                    <Controller
                      control={control}
                      name={"name"}
                      rules={{
                        required: VALIDATION_ERRORS.REQUIRED,
                      }}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          fullWidth
                          error={Boolean(errors?.name)}
                          helperText={errors?.name?.message}
                          value={value || ""}
                          variant="outlined"
                          placeholder="Enter patient's full name"
                          onChange={onChange}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* Age */}
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{
                        mb: 1,
                        display: "flex",
                        alignItems: "center",
                        color: errors?.age ? "error.main" : "inherit",
                      }}
                    >
                      <CakeIcon fontSize="small" sx={{ mr: 1 }} /> Age*
                    </FormLabel>
                    <Controller
                      control={control}
                      name={"age"}
                      rules={{
                        required: VALIDATION_ERRORS.REQUIRED,
                      }}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          fullWidth
                          error={Boolean(errors?.age)}
                          helperText={errors?.age?.message}
                          value={value || ""}
                          variant="outlined"
                          placeholder="Enter age"
                          onChange={onChange}
                          type="number"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                years
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* Gender */}
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{
                        mb: 1,
                        display: "flex",
                        alignItems: "center",
                        color: errors?.gender ? "error.main" : "inherit",
                      }}
                    >
                      <WcIcon fontSize="small" sx={{ mr: 1 }} /> Gender*
                    </FormLabel>
                    <FormControl fullWidth error={Boolean(errors?.gender)}>
                      <Controller
                        control={control}
                        name={"gender"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <RadioGroup
                            row
                            onChange={onChange}
                            value={value || ""}
                            sx={{ justifyContent: "space-around" }}
                          >
                            <FormControlLabel
                              value="F"
                              control={<Radio color="primary" />}
                              label="Female"
                            />
                            <FormControlLabel
                              value="M"
                              control={<Radio color="primary" />}
                              label="Male"
                            />
                            <FormControlLabel
                              value="O"
                              control={<Radio color="primary" />}
                              label="Other"
                            />
                          </RadioGroup>
                        )}
                      />
                      <FormHelperText>{errors?.gender?.message}</FormHelperText>
                    </FormControl>
                  </Box>
                </Grid>

                {/* Place */}
                <Grid item xs={12} sm={6} md={4}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{ mb: 1, display: "flex", alignItems: "center" }}
                    >
                      <LocationOnIcon fontSize="small" sx={{ mr: 1 }} /> Place
                    </FormLabel>
                    <Controller
                      control={control}
                      name={"place"}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          fullWidth
                          error={Boolean(errors?.place)}
                          helperText={errors?.place?.message}
                          value={value || ""}
                          variant="outlined"
                          placeholder="Enter place name"
                          onChange={onChange}
                        />
                      )}
                    />
                  </Box>
                </Grid>

                {/* Phone Number */}
                <Grid item xs={12} sm={6} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <FormLabel
                      component="legend"
                      sx={{ mb: 1, display: "flex", alignItems: "center" }}
                    >
                      <PhoneIcon fontSize="small" sx={{ mr: 1 }} /> Contact
                      Number
                    </FormLabel>
                    <Controller
                      control={control}
                      name={"phone_number"}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          fullWidth
                          error={Boolean(errors?.phone_number)}
                          helperText={errors?.phone_number?.message}
                          value={value || ""}
                          variant="outlined"
                          placeholder="Enter contact number"
                          onChange={onChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                +91
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              {/* Action Buttons */}
              <Grid
                container
                justifyContent="center"
                spacing={2}
                sx={{ mt: 2 }}
              >
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => navigate(-1)}
                    startIcon={<ArrowBackIcon />}
                    size={isMobile ? "medium" : "large"}
                    sx={{ py: 1.2 }}
                  >
                    Back
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={isLoading}
                    type="submit"
                    startIcon={isLoading ? <Loader /> : <SaveIcon />}
                    size={isMobile ? "medium" : "large"}
                    sx={{ py: 1.2 }}
                  >
                    {isLoading ? "Saving..." : "Save Patient"}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}

export default PatientAdd;
