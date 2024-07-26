import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  addDoc,
  orderBy,
} from "firebase/firestore";

import { db } from "./config";

const ref = collection(db, "patients");

export const addPatient = async (data) => {
  try {
    const docRef = await addDoc(ref, data);
    return { data: docRef.id };
  } catch (error) {
    console.error("addPatient :", error);
    throw error;
  }
};

export const fetchPatients = async () => {
  try {
    const q = query(ref, orderBy("ID"));
    const querySnapshot = await getDocs(q);
    let response = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));
    return response || [];
  } catch (error) {
    console.error("fetchPatients :", error);
    throw error;
  }
};

export const fetchPatientsHighestSerialNumber = async () => {
  try {
    const querySnapshot = await getDocs(ref);
    let highestId = 0;
    if (!querySnapshot.empty) {
      const IDs = querySnapshot.docs.map((doc) => Number(doc.data().ID));
      highestId = Math.max(...IDs);
    }
    return highestId;
  } catch (error) {
    console.error("fetchPatientsHighestSerialNumber :", error);
    throw error;
  }
};
