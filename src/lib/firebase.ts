import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-mXOea7ia9170Bu2LGYMUQMQijRiPQok",
  authDomain: "construale.firebaseapp.com",
  projectId: "construale",
  storageBucket: "construale.firebasestorage.app",
  messagingSenderId: "1079391831106",
  appId: "1:1079391831106:web:431860394cb8c0dc1599db",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
