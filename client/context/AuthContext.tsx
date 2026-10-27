// AuthContext.tsx — Login state; the JWT is kept in AsyncStorage

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as api from "../services/api";

const TOKEN_KEY = "@auth_token";
const USERNAME_KEY = "@auth_username";

interface AuthState {
  token: string | null;
  username: string | null;
  restoring: boolean; // true while the saved token is being read at startup
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  // If a token was saved, the user is already logged in and skips the login screen
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUsername] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USERNAME_KEY),
        ]);
        if (savedToken && savedUsername) {
          setToken(savedToken);
          setUsername(savedUsername);
        }
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const result = await api.login(user, password);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, result.token],
      [USERNAME_KEY, result.username],
    ]);
    setToken(result.token);
    setUsername(result.username);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USERNAME_KEY]);
    setToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, username, restoring, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
