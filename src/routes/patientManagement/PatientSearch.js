import Box from "@mui/material/Box";
import { DataGrid } from "@mui/x-data-grid";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { fetchPatients } from "../../firestore/patient";
import Header from "../Header";
import "./PatientsManagement.css";
import GraceDrawer from "../../components/Drawer/Drawer";
import { THEME } from "../../theme";

function PatientSearch() {
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

  const handleRowClick = (params) => {
    setPatient(params.row);
    setOpenDrawer(true);
  };

  const handleCloseDrawer = () => {
    setOpenDrawer(false);
    setPatient({});
  };

  const columns = [
    { field: "ID", headerName: "ID", width: 30 },
    {
      field: "name",
      headerName: "Patient Name",
      width: 150,
      renderCell: (params) => (
        <span
          style={{
            fontWeight: "bold",
            cursor: "pointer",
            color: THEME.COLOR_PRIMARY,
          }}
          onClick={() => handleRowClick(params)}
        >
          {params.value}
        </span>
      ),
    },
    { field: "age", headerName: "Age", width: 120 },
    { field: "gender", headerName: "Gender", width: 60 },
    { field: "complaint", headerName: "Present Complaint", width: 250 },
    { field: "remedy", headerName: "Prescribed Remedy", width: 250 },
    {
      field: "date",
      headerName: "Date of Consultation",
      width: 150,
      renderCell: (params) => dayjs(params.value).format("DD-MMM-YYYY"),
    },

    { field: "remarks", headerName: "Remarks", width: 200 },

    { field: "amount", headerName: "Amount Collected", width: 150 },
  ];

  return (
    <div>
      <Header page={"Patient Management - Search Patient"} />
      <div className="mt-16 text-center">
        <Box
          className="ptmgt-boxes"
          sx={{
            bgcolor: "white",
            width: "75vw",
            mt: "4vh",
            ml: "20vw",
            mr: "30vw",
          }}
        >
          <div>
            <DataGrid
              rows={allPatients}
              columns={columns}
              disableSelectionOnClick
              showCellRightBorder
              autoHeight
              sx={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                fontSize: 14,
                textAlign: "center",
              }}
              getRowId={(row) => row.id}
              hideFooterPagination
              hideFooter
              keepNonExistentRowsSelected
            />

            <br></br>
            <GraceDrawer
              open={openDrawer}
              patient={patient}
              onClose={handleCloseDrawer}
            />
          </div>
        </Box>
      </div>
    </div>
  );
}

export default PatientSearch;
