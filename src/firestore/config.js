import "firebase/compat/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDWt6RxMQVV9wdlU6vbYGwf4O_DaqYxNew",
  authDomain: "grace-homoeo.firebaseapp.com",
  projectId: "grace-homoeo",
  storageBucket: "grace-homoeo.appspot.com",
  messagingSenderId: "231106436960",
  appId: "1:231106436960:web:942c6e78656a784ad10805",
  measurementId: "G-GPEXS4HWZF",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { db, auth, storage, functions, signOut, onAuthStateChanged };
