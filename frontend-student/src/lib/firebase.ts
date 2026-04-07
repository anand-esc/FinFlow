import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAN1iKKRUfgTXuwc5C6dbrwVBR3iIbQ1Bk",
  authDomain: "sparc-agent.firebaseapp.com",
  projectId: "sparc-agent",
  storageBucket: "sparc-agent.firebasestorage.app",
  messagingSenderId: "1070619801160",
  appId: "1:1070619801160:web:db2e5950d38b2017928a7d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(app);

export { auth, googleProvider, signInWithPopup, signOut, storage };
