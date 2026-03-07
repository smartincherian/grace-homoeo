import React, { useEffect, useState } from "react";
import {
  Box,
  TextField,
  IconButton,
  InputAdornment,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  startAt,
  endAt,
} from "firebase/firestore";
import { db } from "../../firebase/config"; // Adjust this import based on your Firebase config location

function PatientSearch() {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Fetch all patients initially
  useEffect(() => {
    fetchAllPatients();
  }, []);

  // Fetch all patients
  const fetchAllPatients = async () => {
    setLoading(true);
    try {
      const patientsCollection = collection(db, "patients");
      const q = query(patientsCollection, orderBy("name"));
      const querySnapshot = await getDocs(q);

      const patientsData = [];
      querySnapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, ...doc.data() });
      });

      setPatients(patientsData);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  // Search patients by name
  const searchPatients = async () => {
    if (!searchTerm.trim()) {
      fetchAllPatients();
      return;
    }

    setLoading(true);
    try {
      const searchTermLower = searchTerm.toLowerCase();

      // Method 1: Using client-side filtering (works with existing data)
      const patientsCollection = collection(db, "patients");
      const q = query(patientsCollection);
      const querySnapshot = await getDocs(q);

      const patientsData = [];
      querySnapshot.forEach((doc) => {
        const patient = { id: doc.id, ...doc.data() };
        // Check if the name contains the search term (case insensitive)
        if (
          patient.name &&
          patient.name.toLowerCase().includes(searchTermLower)
        ) {
          patientsData.push(patient);
        }
      });

      setPatients(patientsData);

      // Method 2 (commented): If you've implemented nameTokens in your database
      // This approach requires setting up nameTokens array in each patient document
      /*
      const patientsCollection = collection(db, "patients");
      const q = query(
        patientsCollection,
        where("nameTokens", "array-contains", searchTermLower)
      );
      
      const querySnapshot = await getDocs(q);
      
      const patientsData = [];
      querySnapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, ...doc.data() });
      });
      
      setPatients(patientsData);
      */
    } catch (error) {
      console.error("Error searching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  // Alternative search method using 'where' if you have a lowercase field or don't need prefix search
  const searchPatientsAlternative = async () => {
    if (!searchTerm.trim()) {
      fetchAllPatients();
      return;
    }

    setLoading(true);
    try {
      const patientsCollection = collection(db, "patients");
      // This requires you to have a 'nameSearch' field that is lowercase in your documents
      // Or you need to ensure case-insensitive searches another way
      const q = query(
        patientsCollection,
        where("nameSearch", ">=", searchTerm.toLowerCase()),
        where("nameSearch", "<=", searchTerm.toLowerCase() + "\uf8ff")
      );

      const querySnapshot = await getDocs(q);

      const patientsData = [];
      querySnapshot.forEach((doc) => {
        patientsData.push({ id: doc.id, ...doc.data() });
      });

      setPatients(patientsData);
    } catch (error) {
      console.error("Error searching patients:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // Handle search submission
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    searchPatients();
  };

  // Clear the search
  const handleClearSearch = () => {
    setSearchTerm("");
    fetchAllPatients();
  };

  // Handle row click
  const handleRowClick = (params) => {
    setSelectedPatient(params.row);
    // You can add more actions here, like opening a drawer
  };

  const columns = [
    { field: "ID", headerName: "ID", width: 70 },
    {
      field: "name",
      headerName: "Patient Name",
      width: 200,
      renderCell: (params) => (
        <Typography
          style={{ fontWeight: "bold", cursor: "pointer", color: "#3f51b5" }}
        >
          {params.value}
        </Typography>
      ),
    },
    { field: "age", headerName: "Age", width: 100 },
    { field: "gender", headerName: "Gender", width: 100 },
    { field: "place", headerName: "Place", width: 150 },
    { field: "complaint", headerName: "Complaint", width: 250 },
  ];

  return (
    <Box sx={{ width: "100%", padding: 2 }}>
      <Paper elevation={3} sx={{ padding: 2, marginBottom: 2 }}>
        <form onSubmit={handleSearchSubmit}>
          <TextField
            fullWidth
            label="Search Patients by Name"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton onClick={handleClearSearch} edge="end">
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </form>
      </Paper>

      <Paper elevation={3} sx={{ height: 400, width: "100%" }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={patients}
            columns={columns}
            pageSize={5}
            rowsPerPageOptions={[5, 10, 20]}
            disableSelectionOnClick
            onRowClick={handleRowClick}
            getRowId={(row) => row.id}
          />
        )}
      </Paper>

      {selectedPatient && (
        <Paper elevation={3} sx={{ padding: 2, marginTop: 2 }}>
          <Typography variant="h6">
            Selected Patient: {selectedPatient.name}
          </Typography>
          {/* Display more details about the selected patient here */}
        </Paper>
      )}
    </Box>
  );
}

export default PatientSearch;
