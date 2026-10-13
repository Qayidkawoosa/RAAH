import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { UserProfile, UserRole } from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string, 
    password: string, 
    name: string, 
    role: UserRole, 
    extraDetails: Record<string, string>
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing cached session on load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const cachedUser = await authService.getCachedSession();
        if (cachedUser) {
          setUser(cachedUser);
        }
      } catch (err) {
        console.error('Failed to load cached session', err);
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await authService.login(email, password);
      setUser(loggedUser);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    name: string, 
    role: UserRole, 
    extraDetails: Record<string, string>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const newUser = await authService.register(email, password, name, role, extraDetails);
      setUser(newUser);
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
