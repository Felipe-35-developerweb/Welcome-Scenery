import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDP0INDJwnAiT4RZNJhn4gTdy7rAEM_POA",
  authDomain: "welcome-scenery.firebaseapp.com",
  projectId: "welcome-scenery",
  storageBucket: "welcome-scenery.firebasestorage.app",
  messagingSenderId: "1045477411448",
  appId: "1:1045477411448:web:89a223649ce6baa6b47b8d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);