'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/providers/UserContext'; // Changed from useAuth
import Link from 'next/link'; // Added for navigation link

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Use `loading` and `contextError` from UserContext.
  // `contextError` is aliased from `error` in useUser to distinguish from local `error` state.
  const { login, loading, error: contextError } = useUser(); 
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // Local error state can be used for client-side validation or specific UI errors
  // not covered by the global authentication error from context.
  const [error, setError] = useState(''); 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear local error state

    try {
      // login from UserContext handles its own error/loading states internally
      await login(username, password);
      
      // If login promise resolves, UserProvider has set user and isAuthenticated.
      // Redirect as per original logic.
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      router.push(redirectTo);
    } catch (err) {
      // This catch block is for unexpected errors during the login call itself,
      // or if the login promise from context *rejects* (which it might not, if it handles all errors internally by setting contextError).
      // Most auth-related errors should be handled by UserContext and reflected in `contextError`.
      console.error('Login failed in component:', err);
      // Optionally, set local error for specific non-auth issues if needed:
      // setError('An unexpected issue occurred. Please try again.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Login to WordPress</h2>
      
      {/* Display error from UserContext */}
      {contextError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {contextError}
        </div>
      )}
      {/* Display local error (e.g., for client-side validation if added later) */}
      {error && !contextError && ( // Only show local error if no contextError
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded-md">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading} // Use loading from UserContext
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log In'} {/* Use loading from UserContext */}
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link href="/signup" className="text-sm text-blue-600 hover:underline">
          Don&apos;t have an account? Sign up here
        </Link>
      </div>
    </div>
  );
}