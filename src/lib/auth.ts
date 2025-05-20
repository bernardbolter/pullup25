// File structure for Next.js App Directory:
// - app/
//   - api/
//     - auth/
//       - login/route.ts (API route for login)
//       - logout/route.ts (API route for logout)
//       - check/route.ts (API route for checking auth status)
//   - dashboard/
//     - page.tsx (protected dashboard page)
//   - login/
//     - page.tsx (login page)
//   - layout.tsx (root layout)
//   - page.tsx (home page)
// - components/
//   - LoginForm.tsx (login form component)
//   - UserDashboard.tsx (dashboard content component)
// - lib/
//   - auth.ts (authentication utilities)
//   - types.ts (type definitions)
//   - providers.tsx (context providers)

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from './types';

// WordPress authentication settings
export const WP_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://your-wordpress-site.com';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';
const TOKEN_NAME = 'wordpress_auth';
const TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

// Authenticate user with WordPress
export async function authenticateWithWordPress(username: string, password: string): Promise<User | null> {
  try {
    const response = await fetch(`${WP_URL}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Authentication failed');
    }

    // Get user data with the token
    const userResponse = await fetch(`${WP_URL}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Bearer ${data.token}`,
      },
      cache: 'no-store',
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Failed to get user data');
    }

    // Create user object
    const user: User = {
      id: userData.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      token: data.token,
    };

    return user;
  } catch (error) {
    console.error('WordPress authentication error:', error);
    return null;
  }
}

// Set authentication token in cookies (server-side)
export function setAuthCookie(user: User) {
  // Create a JWT token with the user data
  const token = jwt.sign(
    {
      userId: user.id,
      username: user.username,
      wpToken: user.token,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  // Get the cookies instance
  const cookieStore = cookies();
  
  // Set the auth cookie
  cookieStore.set(TOKEN_NAME, token, {
    maxAge: TOKEN_EXPIRY,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return token;
}

// Get the current user from the token (server-side)
export function getCurrentUser(): User | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(TOKEN_NAME)?.value;

    if (!token) {
      return null;
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if token is expired
    if (Date.now() >= decoded.exp * 1000) {
      return null;
    }

    // Return user data
    return {
      id: decoded.userId,
      username: decoded.username,
      name: decoded.username, // We might not have the full name in the token
      email: '',  // We might not have the email in the token
      token: decoded.wpToken,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Logout user by clearing cookies (server-side)
export function clearAuthCookie() {
  const cookieStore = cookies();
  cookieStore.delete(TOKEN_NAME);
}

// Check if user is authenticated with WordPress
export async function verifyWordPressToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${WP_URL}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    return response.ok;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}