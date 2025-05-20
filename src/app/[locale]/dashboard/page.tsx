'use client';

import { useAuth } from '@/lib/providers';

export default function UserDashboard() {
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {user ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, {user.name}!</h2>
          <p className="text-gray-600 mb-4">You are successfully logged in to WordPress.</p>
          
          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h3 className="font-medium mb-2">User Information</h3>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Display Name:</strong> {user.name}</p>
          </div>
        </div>
      ) : (
        <p>No user data available. Please login again.</p>
      )}
      
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        Logout
      </button>
    </div>
  );
}