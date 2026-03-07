// Enhanced function for adding or updating patients with nameTokens support
import { db } from "../firebase/config"; // Update path as needed
import { doc, setDoc, collection, addDoc } from "firebase/firestore";

/**
 * Adds or updates a patient document with proper name search fields
 * @param {Object} patientData - The patient data
 * @param {string} [patientId] - Optional patient ID for updates (omit for new patients)
 * @returns {Promise<string>} - The patient document ID
 */
async function savePatient(patientData, patientId = null) {
  try {
    // Create search-friendly fields
    const enhancedData = {
      ...patientData,
      // Convert name to lowercase for case-insensitive searches
      nameSearch: patientData.name ? patientData.name.toLowerCase() : "",
      // Create array of name tokens for partial searches
      nameTokens: patientData.name
        ? patientData.name
            .toLowerCase()
            .split(/\s+|\.+/)
            .filter((token) => token.length > 0)
        : [],
    };

    let docRef;

    // Update existing patient or create new one
    if (patientId) {
      docRef = doc(db, "patients", patientId);
      await setDoc(docRef, enhancedData, { merge: true });
      console.log(`Updated patient with ID: ${patientId}`);
      return patientId;
    } else {
      // Add new patient
      docRef = await addDoc(collection(db, "patients"), enhancedData);
      console.log(`Added new patient with ID: ${docRef.id}`);
      return docRef.id;
    }
  } catch (error) {
    console.error("Error saving patient:", error);
    throw error;
  }
}

export default savePatient;
