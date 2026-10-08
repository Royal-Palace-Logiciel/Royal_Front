// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  type: string;
  role: string;
  statut?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const syncAuth = () => {
      const savedToken = localStorage.getItem('auth-token') || sessionStorage.getItem('auth-token') || localStorage.getItem('token');
      const savedUser = localStorage.getItem('user-data') || sessionStorage.getItem('user-data') || localStorage.getItem('user');

      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } catch (error) {
          console.error('Error restoring session:', error);
          localStorage.removeItem('auth-token');
          localStorage.removeItem('user-data');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
      }
    };

    syncAuth();
    window.addEventListener('auth-change', syncAuth);
    return () => window.removeEventListener('auth-change', syncAuth);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('auth-token', newToken);
    localStorage.setItem('user-data', JSON.stringify(newUser));
    window.dispatchEvent(new Event('auth-change'));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user-data');
    sessionStorage.removeItem('auth-token');
    sessionStorage.removeItem('user-data');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh-token');
    localStorage.removeItem('rememberMe');
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};