import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAgKna7aU98BffoWU7HIOuUFtBoH9bPC2c",
  authDomain: "partners-fde9b.firebaseapp.com",
  projectId: "partners-fde9b",
  storageBucket: "partners-fde9b.firebasestorage.app",
  messagingSenderId: "1056796129707",
  appId: "1:1056796129707:web:c3a82c423f3810c5c02db6",
  measurementId: "G-LJ3R4YF389"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);