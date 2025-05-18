import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGraphQLClient, setAuthToken, removeAuthToken, getAuthToken } from '@/lib/graphql-client';
import { LOGIN_MUTATION, REGISTER_MUTATION } from '@/lib/graphql/mutations';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface LoginInput {
  username: string;
  password: string;
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export const useAuth = () => {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (input: LoginInput) => {
    try {
      setLoading(true);
      setError(null);
      const client = createGraphQLClient();
      const response = await client.request(LOGIN_MUTATION, { input });
      
      if (response.login?.authToken) {
        setAuthToken(response.login.authToken);
        setUser(response.login.user);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    try {
      setLoading(true);
      setError(null);
      const client = createGraphQLClient();
      const response = await client.request(REGISTER_MUTATION, { input });
      
      if (response.registerUser?.user) {
        setUser(response.registerUser.user);
        router.push('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
    router.push('/login');
  };

  const checkAuth = () => {
    const token = getAuthToken();
    return !!token;
  };

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    checkAuth,
  };
}; 