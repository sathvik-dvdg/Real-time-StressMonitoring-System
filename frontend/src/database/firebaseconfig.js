// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth} from "firebase/auth"
import { getFirestore } from 'firebase/firestore'; 

import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyClroBBkO_nj_58w5yNhYAqUA_U68S7j2k",
  authDomain: "stress-manager-ff689.firebaseapp.com",
  projectId: "stress-manager-ff689",
  storageBucket: "stress-manager-ff689.firebasestorage.app",
  messagingSenderId: "255514347347",
  appId: "1:255514347347:web:6c0dc36c7531fc44f9c3a6",
  measurementId: "G-89ZVNZ2WNM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app)
export const db = getFirestore(app);
export {app, auth , analytics}