import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  currentUser: string | null;
  isDM: boolean;
  isLoading: boolean;
  login: (accessCode: string, username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isDM: false,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSessionUser() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (mounted) setCurrentUser(null);
          return;
        }
        const data = await res.json() as { user: string | null };
        if (mounted) {
          setCurrentUser(data.user || null);
        }
      } catch (_err) {
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSessionUser();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (
    accessCode: string,
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessCode, username, password }),
      });
      if (!res.ok) return false;

      const data = await res.json() as { user: string };
      setCurrentUser(data.user);
      return true;
    } catch (_err) {
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (_err) {}
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isDM: currentUser === "DM",
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
