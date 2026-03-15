import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⚠️ REEMPLAZA estos valores con los de tu proyecto Firebase
// (Ve la guía README.md para obtenerlos paso a paso)
const firebaseConfig = {
  apiKey: "AIzaSyAGnJX3jX1-A5UsQ7biZy52ECVj4O089UY",
  authDomain: "meal-planner-a447f.firebaseapp.com",
  projectId: "meal-planner-a447f",
  storageBucket: "meal-planner-a447f.firebasestorage.app",
  messagingSenderId: "1075515435432",
  appId: "1:1075515435432:web:0e4fb9bdf0de74e501559d",
  measurementId: "G-X6G0DPGZGJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
