"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

// Has Provider and Consumer
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Parameterized on any React child
// Called every time AuthProvider (and therefore its children) is rerendered (user or loading is updated)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token"); // JWT token string
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false); // Short circuits to set loading to false if token is null
    }
  }, []);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Checks if token is valid and calls setUser accordingly
  const fetchUser = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem("token"); // Removes token if invalid
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  };

  // Passed through AuthContext
  const login = async (credential: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json", // Tells server it's sending JSON
        },
        body: JSON.stringify({ credential }), // Converts Google JWT token
      });

      if (!response.ok) throw new Error("Authentication failed");

      // Sets local storage token and user
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      setUser(data.user);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Passed through AuthContext
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    // Children are rerendered if user or loading changes
    // AuthContext.Provider broadcasts the data
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  // AuthContext.Provider broadcasts the data
  const context = useContext(AuthContext); // Stores current value from AuthContext.Provider
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
