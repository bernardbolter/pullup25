'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthState } from './types';

// Auth context type
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuth().then(() => {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    });
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setAuthState({
        user: data.user,
        isLoading: false,
        error: null,
      });

      return data.user;
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message || 'An error occurred during login',
      }));
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      
      setAuthState({
        user: null,
        isLoading: false,
        error: null,
      });

      router.push('/login');
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message || 'An error occurred during logout',
      }));
    }
  };

  // Check auth function
  const checkAuth = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/check');
      
      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      const data = await response.json();
      
      setAuthState({
        user: data.user,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error) {
      setAuthState({
        user: null,
        isLoading: false,
        error: null, // Don't set error on routine checks
      });
      return false;
    }
  };

  // Context value
  const value = {
    user: authState.user,
    isLoading: authState.isLoading,
    error: authState.error,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}