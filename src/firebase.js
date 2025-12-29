import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyA54X3MDUJ-WIBaGZUW40nwLhzTpNudFfw",
  authDomain: "reachbee-285e4.firebaseapp.com",
  projectId: "reachbee-285e4",
  storageBucket: "reachbee-285e4.firebasestorage.app",
  messagingSenderId: "393070271133",
  appId: "1:393070271133:web:c4a57fcfe8d3a64ca55274",
  measurementId: "G-Q6TTYLPW6P"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };