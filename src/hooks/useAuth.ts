// src/hooks/useAuth.ts
'use client';

import { useContext } from 'react';
// Adjust the import path if UserContext or UserContextType is exported directly from UserContext.tsx
// Assuming UserContext is the context object and UserContextType is its type,
// and they are exported from where UserProvider is defined.
import { UserContext, UserContextType } from '@/providers/UserContext'; // Adjust path as needed

export const useAuth = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a UserProvider');
  }
  return context;
};
