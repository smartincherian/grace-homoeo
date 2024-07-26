import React, { useState, useEffect, useContext } from "react";
import Header from "../Header";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { Button, FormHelperText, MenuItem } from "@mui/material";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import Box from "@mui/material/Box";
import "./PatientsManagement.css";
import Radio from "@mui/material/Radio";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
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
      <div className="mt-16 text-center">
        <Box
          className="ptmgt-boxes"
          sx={{
            bgcolor: "white",
            width: "40vw",
            mt: "4vh",
            ml: "30vw",
            mr: "30vw",
          }}
        >
          <h2 className="subHeader">Please Enter the Details of Patient</h2>
          <form onSubmit={handleSubmit(saveButtonHandler)}>
            <TableContainer component={Paper}>
              <Table aria-label="simple table">
                <TableBody>
                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Patient ID
                    </TableCell>
                    <Controller
                      control={control}
                      name={"ID"}
                      render={({ field: { onChange, value } }) => (
                        <TableCell
                          sx={{
                            width: "10rem",
                            fontSize: "16px",
                            justifyContent: "center",
                            textAlign: "center",
                            align: "center",
                            pt: "5px",
                            pb: "5px",
                            fontWeight: "bold",
                            color: "#3F497F",
                            backgroundColor: "#FFEBB4",
                            border: "1px solid #C8B6A6",
                          }}
                          align="right"
                        >
                          {value}
                        </TableCell>
                      )}
                    />
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Name of the Patient*
                    </TableCell>

                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"name"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.name}
                            helperText={errors?.name?.message}
                            sx={{
                              width: "10rem",
                              fontSize: "13px",
                              justifyContent: "center",
                              align: "center",
                            }}
                            value={value}
                            variant="standard"
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Age*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"age"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.age}
                            helperText={errors?.age?.message}
                            sx={{
                              width: "10rem",
                              fontSize: "13px",
                              justifyContent: "center",
                              align: "center",
                            }}
                            value={value}
                            variant="standard"
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Gender*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <FormControl
                        component="fieldset"
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Controller
                          control={control}
                          name={"gender"}
                          rules={{
                            required: VALIDATION_ERRORS.REQUIRED,
                          }}
                          render={({ field: { onChange, value } }) => (
                            <RadioGroup
                              aria-labelledby="demo-radio-buttons-group-label"
                              defaultValue="female"
                              name="radio-buttons-group"
                              onChange={onChange}
                              value={value}
                            >
                              <FormControlLabel
                                value="F"
                                control={<Radio />}
                                label="Female"
                              />
                              <FormControlLabel
                                value="M"
                                control={<Radio />}
                                label="Male"
                              />
                              <FormControlLabel
                                value="O"
                                control={<Radio />}
                                label="Other"
                              />
                            </RadioGroup>
                          )}
                        />
                        <FormHelperText error>
                          {errors?.gender?.message}
                        </FormHelperText>
                      </FormControl>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Placename
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      defaultValue={"Manjapra"}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"place"}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.place}
                            helperText={errors?.place?.message}
                            sx={{
                              width: "10rem",
                              fontSize: "13px",
                              justifyContent: "center",
                              align: "center",
                            }}
                            value={value}
                            variant="standard"
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Conact Number
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"phone_number"}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.phone_number}
                            helperText={errors?.phone_number?.message}
                            sx={{
                              width: "10rem",
                              fontSize: "13px",
                              justifyContent: "center",
                              align: "center",
                            }}
                            value={value}
                            variant="standard"
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Present Complaint*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"complaint"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.complaint}
                            helperText={errors?.complaint?.message}
                            multiline
                            InputProps={{
                              style: { fontSize: 13 },
                            }}
                            sx={{
                              width: "20rem",
                              justifyContent: "center",
                              align: "center",
                            }}
                            variant="outlined"
                            value={value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Generals
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"generals"}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.generals}
                            helperText={errors?.generals?.message}
                            multiline
                            InputProps={{
                              style: { fontSize: 13 },
                            }}
                            sx={{
                              width: "20rem",
                              justifyContent: "center",
                              align: "center",
                            }}
                            variant="outlined"
                            value={value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Allergy
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"allergy"}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.allergy}
                            helperText={errors?.allergy?.message}
                            multiline
                            InputProps={{
                              style: { fontSize: 13 },
                            }}
                            sx={{
                              width: "20rem",
                              justifyContent: "center",
                              align: "center",
                            }}
                            variant="outlined"
                            value={value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      History
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"history"}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            multiline
                            error={errors?.history}
                            helperText={errors?.history?.message}
                            InputProps={{
                              style: { fontSize: 13 },
                            }}
                            sx={{
                              width: "20rem",
                              justifyContent: "center",
                              align: "center",
                            }}
                            variant="outlined"
                            value={value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Prescribed Remedy*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"remedy"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.remedy}
                            helperText={errors?.remedy?.message}
                            multiline
                            InputProps={{
                              style: { fontSize: 13 },
                            }}
                            sx={{
                              width: "20rem",
                              justifyContent: "center",
                              align: "center",
                            }}
                            variant="outlined"
                            value={value}
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Remarks
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"remarks"}
                        render={({ field: { onChange, value } }) => (
                          <>
                            <TextField
                              error={errors?.remarks}
                              helperText={errors?.remarks?.message}
                              multiline
                              InputProps={{
                                style: { fontSize: 13 },
                              }}
                              sx={{
                                width: "20rem",
                                justifyContent: "center",
                                align: "center",
                              }}
                              variant="outlined"
                              value={value}
                              onChange={onChange}
                            />

                            {errors.remarks && (
                              <FormHelperText sx={{ color: "red", m: 0 }}>
                                {errors.remarks.message}
                              </FormHelperText>
                            )}
                          </>
                        )}
                      />
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Date of Consultation*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"date"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DatePicker
                              slotProps={{ textField: { size: "small" } }}
                              format="DD-MM-YYYY"
                              // minDate={Date.now()}
                              value={value}
                              onChange={onChange}
                              renderInput={(inputProps) => (
                                <TextField
                                  error={errors?.date}
                                  helperText={errors?.date?.message}
                                  sx={{
                                    width: "10rem",
                                    fontSize: "13px",
                                    justifyContent: "center",
                                    align: "center",
                                  }}
                                  value={value}
                                  variant="standard"
                                  onChange={onChange}
                                />
                              )}
                            />
                          </LocalizationProvider>
                        )}
                      />
                      <Box ml={15}>
                        <FormHelperText error>
                          {errors?.date?.message}
                        </FormHelperText>
                      </Box>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ pt: "5px", pb: "5px", fontSize: "13px" }}
                    >
                      Amount Collected*
                    </TableCell>
                    <TableCell
                      sx={{
                        width: "10rem",
                        fontSize: "13px",
                        justifyContent: "center",
                        align: "center",
                        pt: "5px",
                        pb: "5px",
                      }}
                      align="right"
                    >
                      <Controller
                        control={control}
                        name={"amount"}
                        rules={{
                          required: VALIDATION_ERRORS.REQUIRED,
                        }}
                        render={({ field: { onChange, value } }) => (
                          <TextField
                            error={errors?.amount}
                            helperText={errors?.amount?.message}
                            sx={{
                              width: "10rem",
                              fontSize: "13px",
                              justifyContent: "center",
                              align: "center",
                            }}
                            value={value}
                            variant="standard"
                            onChange={onChange}
                          />
                        )}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="footerButton">
                {/* <Button
                  onClick={() => navigate(-1)}
                  display="inline-block"
                  variant="contained"
                  color="primary"
                  sx={{ mt: 1.5, ml: 15, mb: 1.5, height: "3.5vh" }}
                >
                  Back
                </Button> */}

                <Button
                  variant="contained"
                  display="inline-block"
                  color="primary"
                  disabled={isLoading}
                  type="submit"
                  sx={{ mt: 1.5, ml: 22, mb: 1.5, height: "3.5vh" }}
                >
                  {isLoading ? <Loader /> : "Save"}
                </Button>
              </div>
            </TableContainer>
          </form>
        </Box>
      </div>
    </div>
  );
}

export default PatientAdd;
