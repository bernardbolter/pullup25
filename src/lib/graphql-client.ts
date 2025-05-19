import { GraphQLClient } from 'graphql-request';

const WORDPRESS_GRAPHQL_URL = process.env.NEXT_PUBLIC_WORDPRESS_API_URL_GRAPHQL;

export const createGraphQLClient = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!WORDPRESS_GRAPHQL_URL) {
    throw new Error('WORDPRESS_GRAPHQL_URL is not defined in the environment variables.');
  }

  return new GraphQLClient(WORDPRESS_GRAPHQL_URL, {
    headers,
  });
};

export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};