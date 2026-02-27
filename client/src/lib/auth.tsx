import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ACCOUNTS } from "@shared/schema";

interface AuthContextType {
  currentUser: string | null;
  isDM: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isDM: false,
  login: () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("campaign_user");
    if (stored) {
      const account = ACCOUNTS.find(a => a.username === stored);
      if (account) {
        setCurrentUser(stored);
      } else {
        localStorage.removeItem("campaign_user");
      }
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    const account = ACCOUNTS.find(
      a => a.username.toLowerCase() === username.toLowerCase() && a.password === password
    );
    if (account) {
      localStorage.setItem("campaign_user", account.username);
      setCurrentUser(account.username);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem("campaign_user");
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isDM: currentUser === "DM", login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
