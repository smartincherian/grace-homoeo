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
  limit,
} from "firebase/firestore";

import { db } from "./config";

const ref = collection(db, "consultation");

export const addConsultation = async (data) => {
  try {
    const docRef = await addDoc(ref, data);
    return { data: docRef.id };
  } catch (error) {
    console.error("addConsultation :", error);
    throw error;
  }
};

export const fetchPatientConsultations = async (patientId) => {
  try {
    const ref = collection(db, "consultations"); // ensure this matches your collection name

    const q = query(
      ref,
      where("patientId", "==", patientId),
      orderBy("date", "desc") // assuming `date` is a Firestore Timestamp or ISO string
    );

    const querySnapshot = await getDocs(q);
    let response = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return response || [];
  } catch (error) {
    console.error("fetchPatientConsultations:", error);
    throw error;
  }
};

export const fetchPreviousConsultations = async (number = 20) => {
  try {
    const ref = collection(db, "consultations"); // ensure this matches your collection name

    const q = query(
      ref,
      orderBy("date", "desc"), // assuming `date` is a Firestore Timestamp or ISO string
      limit(number)
    );

    const querySnapshot = await getDocs(q);
    let response = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return response || [];
  } catch (error) {
    console.error("fetchPreviousConsultations:", error);
    throw error;
  }
};
