// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAFj3SR_sNMX8P3XEJ7sOacq4ngxfsAOjo",
  authDomain: "voicenote-4eb63.firebaseapp.com",
  projectId: "voicenote-4eb63",
  storageBucket: "voicenote-4eb63.firebasestorage.app",
  messagingSenderId: "507749807962",
  appId: "1:507749807962:web:22177b6ddcff274dc1e563",
  measurementId: "G-L79F4MH6EJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);