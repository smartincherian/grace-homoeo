// When adding or updating a patient document
const fullName = "Sr. Veronica Devassy";
const nameTokens = fullName.toLowerCase().split(/\s+|\.+/); // ['sr', 'veronica', 'devassy']

const patientData = {
  name: "Sr. Veronica Devassy",
  nameSearch: "sr. veronica devassy", // Lowercase version for case-insensitive searching
  nameTokens: nameTokens, // Array for partial matching
  age: "72",
  gender: "F",
  // other fields...
};

//client side

// Search using any part of the name (like "veronica" to find "Sr. Veronica Devassy")
const nameQuery = query(
  collection(db, "patients"),
  where("nameTokens", "array-contains", searchTerm.toLowerCase())
);

// method 2
const patientsCollection = collection(db, "patients");
const q = query(patientsCollection); // Get all patients
const querySnapshot = await getDocs(q);

// Filter on the client side
const results = querySnapshot.docs
  .map((doc) => ({ id: doc.id, ...doc.data() }))
  .filter(
    (patient) =>
      patient.name &&
      patient.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

// debouncing

import { useEffect, useState } from "react";
import debounce from "lodash/debounce";

// In your component
const [searchTerm, setSearchTerm] = useState("");

// Create a debounced search function
const debouncedSearch = useCallback(
  debounce((term) => {
    // Your search function here
    searchPatients(term);
  }, 300),
  []
);

// Use it when the search term changes
useEffect(() => {
  if (searchTerm.trim()) {
    debouncedSearch(searchTerm);
  }
}, [searchTerm, debouncedSearch]);
