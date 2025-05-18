"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/graphql-client'; // Your function to get the token
import { GET_USER_INFO } from '@/lib/graphql/queries'; // Your query to get user info
import client from '@/lib/graphql/client'; // Your Apollo Client instance

interface User {
  id: string;
  email: string;
  username: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const token = getAuthToken();
      console.log("authorized", token);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await client.query({
          query: GET_USER_INFO,
          context: {
            headers: {
              Authorization: `Bearer ${token}`, // Include the token in the headers
            },
          },
          fetchPolicy: 'network-only',
        });
        setUser(data.viewer);
      } catch (err) {
        if (err instanceof Error) {
            setError(err.message); // Use err.message if err is an instance of Error
          } else {
            setError('An unknown error occurred'); // Fallback for unknown error types
          }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error }}>
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