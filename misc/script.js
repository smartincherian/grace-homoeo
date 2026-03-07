// Migration Script for Adding nameTokens to Existing Patient Documents
// Run this script as a one-time operation to update your existing patient documents

import { db } from "../firebase/config"; // Update path as needed
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

/**
 * Adds nameTokens field to existing patient documents
 * This enables partial name searching
 */
async function migratePatients() {
  const patientsRef = collection(db, "patients");
  const snapshot = await getDocs(patientsRef);

  console.log(`Found ${snapshot.docs.length} patients to update`);
  let updateCount = 0;

  for (const docSnapshot of snapshot.docs) {
    const patient = docSnapshot.data();

    if (patient.name) {
      // Create name tokens from the patient's name
      // This splits by spaces and periods and converts to lowercase
      const nameTokens = patient.name
        .toLowerCase()
        .split(/\s+|\.+/)
        .filter((token) => token.length > 0);

      // Update the document with the new nameTokens field
      try {
        await updateDoc(doc(db, "patients", docSnapshot.id), {
          nameTokens: nameTokens,
        });
        updateCount++;
        console.log(
          `Updated patient: ${patient.name} with tokens: ${nameTokens.join(
            ", "
          )}`
        );
      } catch (error) {
        console.error(`Error updating patient ${patient.name}:`, error);
      }
    }
  }

  console.log(`Successfully updated ${updateCount} patient documents`);
}

// Example usage
// migratePatients().then(() => console.log("Migration complete"));

export default migratePatients;
