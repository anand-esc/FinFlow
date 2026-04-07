import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth, googleProvider, signInWithPopup, signOut } from "../lib/firebase";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'student' | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ADMIN_EMAILS = ["suryansh.anand.dev@gmail.com"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'student' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u && u.email) {
         setRole(ADMIN_EMAILS.includes(u.email) ? 'admin' : 'student');
      } else {
         setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
       await signInWithPopup(auth, googleProvider);
    } catch(err) {
       console.error(err);
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, role, loading, loginWithGoogle, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
