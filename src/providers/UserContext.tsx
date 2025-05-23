"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string; // Ensure this is present
  name?: string; // Add name as optional
  token?: string;
}

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean; // Add this
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>; // Add this
  logout: () => Promise<void>; // Add this
  checkAuthStatusAndFetchUser: () => Promise<void>; // Add this
  signup: (username: string, email: string, password: string) => Promise<void>; // Add signup
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Added
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatusAndFetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/me'); // GET is default
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        if (response.status !== 401) { // Don't set error for routine "not logged in"
          const errorData = await response.json();
          setError(errorData.error || 'Failed to fetch user status.');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during auth check.');
      }
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json(); // Always parse JSON to get potential error messages
      if (response.status === 201) { // Successfully created
        setUser(data); // API returns user object { id, username, email, name }
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setError(data.message || data.error || 'Signup failed.'); // Use message from API
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during signup.');
      }
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data); // Assuming API returns user object directly on success
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred during login.');
      }
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Log error, but still clear client-side auth state
      console.error("Logout API call failed:", err);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      // Optionally clear any specific error messages related to user state
      setError(null);
    }
  };

  useEffect(() => {
    checkAuthStatusAndFetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, isAuthenticated, loading, error, login, logout, signup, checkAuthStatusAndFetchUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export { UserContext}