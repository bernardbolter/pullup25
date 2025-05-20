'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtVerify } from 'jose';
import Cookies from 'js-cookie';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = Cookies.get('wordpress_auth');
        
        if (!token) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
        
        // Optional: Verify token on client side
        // Only really needed if you want to check expiry or other claims
        // For production, prefer server validation
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);

  return { isAuthenticated, isLoading };
}