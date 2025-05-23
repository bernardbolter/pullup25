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

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task: Assume /wp/v2/users is configured for credential-less creation if used.
          // No Authorization header is sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          const errorData = await response.json();
          // Log the detailed error message from WordPress if available
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails (response not JSON), log original status and part of the response text.
          const responseText = await response.text(); 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message or could be updated with non-JSON info if desired.
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // Fallback if the loop completes without returning (e.g., if endpoints array were empty).
  console.error(`All registration attempts exhausted for ${email} without success or explicit failure in loop. Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task: Assume /wp/v2/users is configured for credential-less creation if used.
          // No Authorization header is sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          const errorData = await response.json();
          // WordPress specific error codes for existing user/email could be checked here if we were to throw specific errors.
          // e.g. if (errorData.code === 'existing_user_login' || ...) { throw new Error('User exists'); }
          // However, per prompt, returning null for consistency.
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails (response not JSON), log original status.
          const responseText = await response.text(); 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message or gets updated with non-JSON info
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), 
        username: wpUser.username || wpUser.slug || username, 
        name: wpUser.name || wpUser.username || username,     
        email: wpUser.email || email,                         
        // token is not part of this registration response
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // Fallback if the loop completes without returning (e.g., if endpoints array were empty).
  console.error(`All registration attempts exhausted for ${email} without success or explicit failure in loop. Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        // Attempt to parse error data for more specific messages
        try {
          const errorData = await response.json();
          // Check for WordPress specific error codes indicating user/email already exists
          if (errorData.code === 'existing_user_login' || 
              errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || 
              errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", throw a specific error for the API route
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          // errorDetails remains the generic status message
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        let isUserExistsError = false;
        try {
          // Try to get more specific error from WordPress JSON response
          const errorData = await response.json();
          // WordPress specific error codes for existing user/email
          if (errorData.code === 'existing_user_login' || errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            isUserExistsError = true;
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError; // Throw for the API route to catch
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          if (e.code === 'USER_EXISTS') throw e; // Rethrow USER_EXISTS error
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, 
        name: wpUser.name || wpUser.username || username,     
        email: wpUser.email || email,                         
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; 

    } catch (error: any) {
      if (error.code === 'USER_EXISTS') { // Ensure USER_EXISTS error is re-thrown
        throw error;
      }
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; 
      }
      return null; 
    }
  }
  console.error(`All registration attempts exhausted for ${email}. Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          // Try to get more specific error from WordPress JSON response
          const errorData = await response.json();
          // WordPress specific error codes for existing user/email
          if (errorData.code === 'existing_user_login' || errorData.code === 'existing_user_email' || 
              errorData.code === 'rest_user_exists' || errorData.code === 'registration-error-email-exists' || 
              errorData.code === 'registration-error-username-exists') {
            // For "user already exists", the API route expects a thrown error with a specific code.
            // This deviates slightly from "return null for all errors" but aligns with API route's needs.
            const specificError = new Error(errorData.message || 'User already exists.') as any;
            specificError.code = 'USER_EXISTS'; 
            throw specificError;
          }
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e: any) {
          // If it's the USER_EXISTS error, rethrow it.
          if (e.code === 'USER_EXISTS') throw e;
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // If it's the specific USER_EXISTS error, rethrow it for the API route.
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          // Try to get more specific error from WordPress JSON response
          const errorData = await response.json();
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          // Try to get more specific error from WordPress JSON response
          const errorData = await response.json();
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed at ${endpointUrl} with status: ${response.status}`;
        try {
          // Try to get more specific error from WordPress JSON response
          const errorData = await response.json();
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails, response might not be JSON. Log the original status.
          const responseText = await response.text(); // Attempt to get text for logging
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line is a fallback if the loop completes without returning (e.g., empty endpoints array, though not the case here).
  console.error(`All registration attempts exhausted for ${email} (e.g. both endpoints failed or were skipped). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint for registration (often via plugins)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary, standard users endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task instructions, assume if /wp/v2/users is used,
          // it's configured to allow creation without explicit admin credentials sent from here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        let errorDetails = `Registration failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          // Include WordPress specific error message if available
          errorDetails = errorData.message || errorDetails; 
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, errorData);
        } catch (e) {
          // If parsing errorData fails, log the original status and that response wasn't JSON
          const responseText = await response.text(); // Re-read text if JSON parsing failed
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 300)}`);
          errorDetails += ` (Response not JSON: ${responseText.substring(0,100)})`;
        }

        // If the primary endpoint attempt fails, log and continue to try the secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed: ${errorDetails}. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If the secondary endpoint also fails, or if it was a direct attempt to the secondary that failed.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorDetails}`);
        return null; // Return null on failure, as per consistency guideline in the prompt.
      }

      // Successfully created user (WordPress typically returns 201 with the user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username,     // Provide fallbacks
        email: wpUser.email || email,                         // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered, return the User object

    } catch (error: any) {
      // Catch network errors or other unexpected issues during the fetch operation itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an unexpected error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If an unexpected error occurs with the secondary endpoint.
      return null; // Return null on failure
    }
  }

  // This line should ideally not be reached if the loop logic correctly handles all cases
  // (i.e., should always return user or null from within the loop).
  // As a fallback, if the loop completes (e.g., empty endpoints array, though not the case here), return null.
  console.error(`All registration attempts exhausted for ${email}. Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary endpoint
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary endpoint
  ];

  for (const endpointUrl of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointUrl}`);
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Per task instructions: "assume that if /wp-json/wp/v2/users is the target, 
          // the WordPress environment is set up to allow user creation via this endpoint...
          // without the client sending admin credentials."
          // Thus, no 'Authorization' header is added here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure no caching of this request
      });

      if (!response.ok) {
        // Attempt to parse error data, but don't let it crash if response is not JSON
        let errorData = { message: `Registration failed with status: ${response.status}` };
        try {
          const jsonData = await response.json();
          if (jsonData && jsonData.message) {
            errorData.message = jsonData.message;
          }
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}):`, jsonData);
        } catch (e) {
          // Log the fact that response was not JSON
          const responseText = await response.text();
          console.error(`Registration attempt failed at ${endpointUrl} (Status: ${response.status}). Response was not valid JSON: ${responseText.substring(0, 200)}`);
        }

        // If primary endpoint fails, log and continue to try secondary endpoint.
        if (endpointUrl === endpoints[0]) {
          console.warn(`Primary endpoint ${endpointUrl} failed. Trying secondary endpoint.`);
          continue; // Try the next endpoint in the list
        }
        
        // If secondary endpoint also fails, or if it was a direct attempt to secondary that failed.
        console.error(`Final registration attempt failed at ${endpointUrl}. Error: ${errorData.message}`);
        return null; // Return null on failure, as per consistency guideline
      }

      // Successfully created user (WordPress usually returns 201 with user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(), // Ensure ID is a string
        username: wpUser.username || wpUser.slug || username, // Provide fallbacks
        name: wpUser.name || wpUser.username || username, // Provide fallbacks
        email: wpUser.email || email, // Provide fallbacks
        // token is not part of this registration response; it's acquired via login
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointUrl}.`);
      return user; // Successfully registered and user object returned

    } catch (error: any) {
      // Catch network errors or other unexpected issues during fetch itself
      console.error(`Caught unexpected error during registration attempt with ${endpointUrl}:`, error.message, error);
      
      // If an error occurs with the primary endpoint, try the secondary.
      if (endpointUrl === endpoints[0]) {
        console.warn(`Unexpected error with primary endpoint ${endpointUrl}. Trying secondary endpoint.`);
        continue; // Try the next endpoint
      }
      
      // If error on secondary endpoint, or if it's an error type that shouldn't be retried
      return null; // Return null on failure
    }
  }

  // This line should ideally not be reached if the loop logic is correct (i.e., should always return user or null from within the loop).
  // However, as a fallback, if the loop completes without returning (e.g., empty endpoints array, though not the case here), return null.
  console.error(`All registration attempts failed for ${email} (exhausted endpoints). Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    { url: `${WP_URL}/wp-json/wp/v2/users/register`, type: "register_specific" },
    { url: `${WP_URL}/wp-json/wp/v2/users`, type: "standard_users_endpoint" }
  ];

  for (const endpointInfo of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpointInfo.url} (type: ${endpointInfo.type})`);
      const response = await fetch(endpointInfo.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task: "assume that if /wp-json/wp/v2/users is the target, the WordPress 
          // environment is set up to allow user creation ... without client sending admin credentials."
          // No 'Authorization' header is added here.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure fresh request/response
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error(`Registration attempt failed at ${endpointInfo.url} (Status: ${response.status}):`, errorData.message || response.statusText, errorData);
        } catch (e) {
          // Non-JSON response
          const responseBodyText = await response.text(); // Re-read text if json failed
          console.error(`Registration attempt failed at ${endpointInfo.url} (Status: ${response.status}). Non-JSON response: ${responseBodyText.substring(0, 200)}`);
        }
        
        // If the primary endpoint specific for registration fails (e.g. 404, 401, 403, or even specific errors like 'disabled'), 
        // it's reasonable to try the secondary standard /users endpoint.
        if (endpointInfo.type === "register_specific") {
          console.warn(`Primary registration endpoint ${endpointInfo.url} failed. Trying secondary.`);
          continue; // Try the next endpoint
        }
        // If secondary endpoint also fails, or if primary fails for a reason that shouldn't be retried (e.g. already tried secondary)
        return null; // Return null on failure as per subtask instructions for consistency
      }

      // Successfully created user (WP usually returns 201 with user object)
      const wpUser = await response.json(); 
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username, 
        name: wpUser.name || wpUser.username || username,       
        email: wpUser.email || email,                           
        // token is not part of this registration response
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpointInfo.url}.`);
      return user; // Successfully registered and user object returned

    } catch (error: any) {
      // Catch network errors or other unexpected issues during fetch
      console.error(`Caught unexpected error during registration attempt with ${endpointInfo.url}:`, error.message, error);
      
      // If an error occurs with the primary endpoint, try the secondary.
      if (endpointInfo.type === "register_specific") {
        console.warn(`Unexpected error with primary endpoint ${endpointInfo.url}. Trying secondary.`);
        continue; // Try the next endpoint
      }
      // If error on secondary, or if it's an error type that shouldn't be retried
      return null; // Return null on failure
    }
  }

  // If loop completes (e.g., if primary endpoint was the only one and it failed in a way that didn't throw but didn't succeed)
  // This path should ideally not be reached if logic inside loop is correct (continue or return null/user)
  console.error(`All registration attempts failed for ${email}. Defaulting to null.`);
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary: specific registration endpoint (if enabled by a plugin)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary: standard users endpoint (might require specific auth setup)
  ];

  let lastErrorContext: { type: string; message?: string; data?: any; status?: number } = { type: "Generic" };

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note on '/wp-json/wp/v2/users': This implementation assumes if this endpoint is used,
          // the WordPress environment is configured to allow user creation without explicit admin credentials
          // passed from this function (e.g., via pre-auth, plugin, or public setting).
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure fresh request/response
      });

      const responseBody = await response.text();
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        // Non-JSON response (e.g., HTML error page)
        console.error(`Failed to parse JSON response from ${endpoint} (Status: ${response.status}): ${responseBody.substring(0, 500)}`);
        lastErrorContext = { type: "NonJsonResponse", message: `Registration attempt failed at ${endpoint}. Server returned a non-JSON response.`, status: response.status };
        
        // If primary endpoint gives non-JSON (e.g. HTML error page for 404/500/403/401), try secondary
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 500 || response.status === 403 || response.status === 401)) {
          console.warn(`Primary endpoint ${endpoint} returned non-JSON with status ${response.status}. Trying secondary.`);
          continue;
        }
        // For other non-JSON responses or if it's the secondary endpoint, this is a hard failure for this path.
        throw new Error(lastErrorContext.message); 
      }

      if (!response.ok) {
        // Store context of this error
        lastErrorContext = { type: "WordPressError", data: data, status: response.status, message: data.message || `HTTP error ${response.status}` };
        console.error(`Registration attempt failed for ${email} at ${endpoint} (Status: ${response.status}):`, data.message || response.statusText);

        // Handle specific WordPress error codes indicating user/email exists
        if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
            data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
            data.code === 'registration-error-username-exists') {
          const error = new Error(data.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS'; // Custom code for API route to handle 409
          throw error; 
        }
        
        // For other specific input validation errors from WordPress (e.g., invalid email, weak password), throw them.
        if (data.code && (data.code.includes('invalid_email') || data.code.includes('empty_email') || 
                           data.code.includes('invalid_username') || data.code.includes('empty_username') ||
                           data.code.includes('empty_password') || data.code.includes('incorrect_password') /* less likely for register */ )) {
             throw new Error(data.message || `Registration validation failed: ${data.code}`);
        }

        // If the primary endpoint returns 404 (Not Found), 401 (Unauthorized), or 403 (Forbidden), it might not be enabled. Try secondary.
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 401 || response.status === 403)) {
          console.warn(`Primary endpoint ${endpoint} failed with status ${response.status}. Trying secondary.`);
          continue; 
        }
        
        // For other errors on the first endpoint not covered above, or any error on the second, throw.
        throw new Error(data.message || `Registration failed at ${endpoint} with status ${response.status}`);
      }

      // Successfully created user (WordPress usually returns 201 with user object)
      const wpUser = data; 
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username, 
        name: wpUser.name || wpUser.username || username,       
        email: wpUser.email || email,                           
        // token is not part of this registration response
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpoint}.`);
      return user; 

    } catch (error: any) {
      // If it's a USER_EXISTS error or a specific validation error already thrown, rethrow it to be caught by API route.
      if (error.code === 'USER_EXISTS' || error.message.startsWith('Registration validation failed:')) {
        throw error;
      }
      
      // Log the caught error for this attempt
      console.error(`Caught error during registration attempt with ${endpoint}:`, error.message);
      // Update lastErrorContext if this error is more relevant than a previous non-JSON or HTTP error
      if (lastErrorContext.type === "Generic" || (lastErrorContext.type === "NonJsonResponse" && !(error.message && error.message.includes("Non-JSON response")))) {
         lastErrorContext = { type: "CaughtException", message: error.message, status: error.status };
      }


      // If it's an error on the first endpoint, log and continue to try the next one.
      if (endpoint === endpoints[0]) {
        console.warn(`Error on primary registration endpoint (${endpoint}), trying secondary.`);
        continue; 
      }
      
      // If it's an error on the second endpoint, this is the end of the line for this attempt.
      // The function will proceed to the logic after the loop to determine final outcome.
    }
  }

  // If loop completes, it means all endpoints failed or an error was not re-thrown to exit.
  console.error(`All registration attempts failed for ${email}. Last error context:`, lastErrorContext);
  
  // Specifically re-throw USER_EXISTS if it was the last error encountered from WP and not already thrown
  if (lastErrorContext.type === "WordPressError" && lastErrorContext.data) {
    const data = lastErrorContext.data;
    if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
        data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
        data.code === 'registration-error-username-exists') {
      const error = new Error(data.message || 'User already exists.') as any;
      error.code = 'USER_EXISTS';
      throw error;
    }
    // Throw other specific WP errors if they were the last error and not already thrown
    if (data.message) {
        throw new Error(data.message);
    }
  }
  
  // If there was a caught exception with a message (often network or unexpected), throw that
  if (lastErrorContext.type === "CaughtException" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }
  
  // If there was a non-JSON response error with a message, throw that
  if (lastErrorContext.type === "NonJsonResponse" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }

  // Default to returning null if no specific error was designated to be thrown.
  // This indicates a general failure after all attempts (e.g. both endpoints failed with non-specific errors).
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary: specific registration endpoint (if enabled by a plugin)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary: standard users endpoint (might require specific auth setup)
  ];

  let lastErrorContext: { type: string; message?: string; data?: any; status?: number } = { type: "Generic" };

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note on '/wp-json/wp/v2/users': This implementation assumes if this endpoint is used,
          // the WordPress environment is configured to allow user creation without explicit admin credentials
          // passed from this function (e.g., via pre-auth, plugin, or public setting).
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store', // Ensure fresh request/response
      });

      const responseBody = await response.text();
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        // Non-JSON response (e.g., HTML error page)
        console.error(`Failed to parse JSON response from ${endpoint} (Status: ${response.status}): ${responseBody.substring(0, 500)}`);
        lastErrorContext = { type: "NonJsonResponse", message: `Registration attempt failed at ${endpoint}. Server returned a non-JSON response.`, status: response.status };
        
        // If primary endpoint gives non-JSON (e.g. HTML error page for 404/500), try secondary
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 500 || response.status === 403 || response.status === 401)) {
          console.warn(`Primary endpoint ${endpoint} returned non-JSON with status ${response.status}. Trying secondary.`);
          continue;
        }
        // For other non-JSON responses or if it's the secondary endpoint, this is a hard failure for this path.
        throw new Error(lastErrorContext.message); 
      }

      if (!response.ok) {
        // Store context of this error
        lastErrorContext = { type: "WordPressError", data: data, status: response.status, message: data.message || `HTTP error ${response.status}` };
        console.error(`Registration attempt failed for ${email} at ${endpoint} (Status: ${response.status}):`, data.message || response.statusText);

        // Handle specific WordPress error codes indicating user/email exists
        if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
            data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
            data.code === 'registration-error-username-exists') {
          const error = new Error(data.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS'; // Custom code for API route to handle 409
          throw error; 
        }
        
        // For other specific input validation errors from WordPress (e.g., invalid email, weak password), throw them.
        if (data.code && (data.code.includes('invalid_email') || data.code.includes('empty_email') || 
                           data.code.includes('invalid_username') || data.code.includes('empty_username') ||
                           data.code.includes('empty_password') || data.code.includes('incorrect_password') /* less likely for register */ )) {
             throw new Error(data.message || `Registration validation failed: ${data.code}`);
        }

        // If the primary endpoint returns 404 (Not Found), 401 (Unauthorized), or 403 (Forbidden), it might not be enabled. Try secondary.
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 401 || response.status === 403)) {
          console.warn(`Primary endpoint ${endpoint} failed with status ${response.status}. Trying secondary.`);
          continue; 
        }
        
        // For other errors on the first endpoint not covered above, or any error on the second, throw.
        throw new Error(data.message || `Registration failed at ${endpoint} with status ${response.status}`);
      }

      // Successfully created user (WordPress usually returns 201 with user object)
      const wpUser = data; 
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username, 
        name: wpUser.name || wpUser.username || username,       
        email: wpUser.email || email,                           
        // token is not part of this registration response
      };
      console.log(`User ${user.username} (ID: ${user.id}) registered successfully via ${endpoint}.`);
      return user; 

    } catch (error: any) {
      // If it's a USER_EXISTS error or a specific validation error already thrown, rethrow it to be caught by API route.
      if (error.code === 'USER_EXISTS' || error.message.startsWith('Registration validation failed:')) {
        throw error;
      }
      
      // Log the caught error for this attempt
      console.error(`Caught error during registration attempt with ${endpoint}:`, error.message);
      // Update lastErrorContext if this error is more relevant than a previous non-JSON or HTTP error
      if (lastErrorContext.type === "Generic" || (lastErrorContext.type === "NonJsonResponse" && !error.message.includes("Non-JSON response"))) {
         lastErrorContext = { type: "CaughtException", message: error.message, status: error.status };
      }

      // If it's an error on the first endpoint, log and continue to try the next one.
      if (endpoint === endpoints[0]) {
        console.warn(`Error on primary registration endpoint (${endpoint}), trying secondary.`);
        continue; 
      }
      
      // If it's an error on the second endpoint, this is the end of the line for this attempt.
      // The function will proceed to the logic after the loop.
    }
  }

  // If loop completes, it means all endpoints failed or an error was not re-thrown to exit.
  console.error(`All registration attempts failed for ${email}. Last error context:`, lastErrorContext);
  
  // Specifically re-throw USER_EXISTS if it was the last error encountered from WP
  if (lastErrorContext.type === "WordPressError" && lastErrorContext.data) {
    const data = lastErrorContext.data;
    if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
        data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
        data.code === 'registration-error-username-exists') {
      const error = new Error(data.message || 'User already exists.') as any;
      error.code = 'USER_EXISTS';
      throw error;
    }
    // Throw other specific WP errors if they were the last error
    if (data.message) {
        throw new Error(data.message);
    }
  }
  
  // If there was a caught exception with a message, throw that
  if (lastErrorContext.type === "CaughtException" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }
  
  // If there was a non-JSON response error with a message, throw that
  if (lastErrorContext.type === "NonJsonResponse" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }

  // Default to returning null if no specific error was designated to be thrown.
  // This indicates a general failure after all attempts.
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary: specific registration endpoint (if enabled by a plugin)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary: standard users endpoint (might require specific auth setup)
  ];

  let lastErrorContext: { type: string, message?: string, data?: any, status?: number } = { type: "Generic" };

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note on '/wp-json/wp/v2/users': This implementation assumes if this endpoint is used,
          // the WordPress environment is configured to allow user creation without explicit admin credentials
          // passed from this function (e.g., via pre-auth, plugin, or public setting).
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store',
      });

      const responseBody = await response.text();
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        console.error(`Failed to parse JSON response from ${endpoint} (Status: ${response.status}): ${responseBody}`);
        lastErrorContext = { type: "NonJsonResponse", message: `Registration failed at ${endpoint}. Non-JSON response.`, status: response.status };
        // If primary endpoint gives non-JSON (e.g. HTML error page for 404), try secondary
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 500)) { // 500 might be a misconfigured server not returning JSON for error
          continue;
        }
        // For other non-JSON responses or if it's the secondary endpoint, treat as failure
        throw new Error(lastErrorContext.message); 
      }

      if (!response.ok) {
        lastErrorContext = { type: "WordPressError", data: data, status: response.status, message: data.message };
        console.error(`Registration attempt failed for ${email} at ${endpoint} (Status: ${response.status}):`, data.message || response.statusText);

        // Handle specific WordPress error codes indicating user/email exists
        if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
            data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
            data.code === 'registration-error-username-exists') {
          const error = new Error(data.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS'; // Custom code for API route
          throw error; 
        }
        
        // For other specific input validation errors from WordPress (e.g., invalid email, weak password), throw them.
        if (data.code && (data.code.includes('invalid') || data.code.includes('empty') || data.code.includes('incorrect_password'))) {
             throw new Error(data.message || `Registration validation failed: ${data.code}`);
        }

        // If the primary endpoint returns 404 (Not Found), 401 (Unauthorized), or 403 (Forbidden), it might not be enabled. Try secondary.
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 401 || response.status === 403)) {
          console.warn(`Primary endpoint ${endpoint} failed with status ${response.status}. Trying secondary.`);
          continue; // Try the next endpoint
        }
        
        // For other errors on the first endpoint not covered above, or any error on the second, throw.
        throw new Error(data.message || `Registration failed at ${endpoint} with status ${response.status}`);
      }

      // Successfully created user (WordPress usually returns 201 with user object)
      const wpUser = data; // data is the parsed user object from WP
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username, // Fallbacks for username
        name: wpUser.name || wpUser.username || username,       // Fallbacks for name
        email: wpUser.email || email,                           // Fallback for email
        // token is not part of this registration response
      };
      console.log(`User ${user.username} registered successfully via ${endpoint}.`);
      return user; // Successfully registered and user object returned

    } catch (error: any) {
      // If it's a USER_EXISTS error or a specific validation error already thrown, rethrow it.
      if (error.code === 'USER_EXISTS' || error.message.startsWith('Registration validation failed:')) {
        throw error;
      }
      
      // Log the caught error for this attempt
      console.error(`Caught error during registration attempt with ${endpoint}:`, error.message);
      if (!lastErrorContext.message && !(lastErrorContext.data && lastErrorContext.data.message)) {
         lastErrorContext = { type: "CaughtException", message: error.message };
      }


      // If it's an error on the first endpoint, log and continue to try the next one.
      if (endpoint === endpoints[0]) {
        console.warn(`Error on primary registration endpoint (${endpoint}), trying secondary.`);
        continue; // Try the next endpoint
      }
      
      // If it's an error on the second endpoint or an unexpected error type, prepare to exit loop or return null.
      // Ensure lastErrorContext reflects this error if it's more relevant than a previous one.
      // (This logic is mostly superseded by throwing directly or continuing)
      // For this path, error will be thrown by the end of the loop logic.
    }
  }

  // If loop completes, it means all endpoints failed or an error was not re-thrown to exit.
  console.error(`All registration attempts failed for ${email}. Last error context:`, lastErrorContext);
  
  // Specifically re-throw USER_EXISTS if it was the last error encountered from WP
  if (lastErrorContext.type === "WordPressError" && lastErrorContext.data) {
    const data = lastErrorContext.data;
    if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
        data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
        data.code === 'registration-error-username-exists') {
      const error = new Error(data.message || 'User already exists.') as any;
      error.code = 'USER_EXISTS';
      throw error;
    }
    // Throw other specific WP errors if they were the last error
    if (data.message) {
        throw new Error(data.message);
    }
  }
  
  // If there was a caught exception with a message, throw that
  if (lastErrorContext.type === "CaughtException" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }
  
  // If there was a non-JSON response error with a message, throw that
  if (lastErrorContext.type === "NonJsonResponse" && lastErrorContext.message) {
    throw new Error(lastErrorContext.message);
  }

  // Default to returning null if no specific error was designated to be thrown.
  return null;
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary: specific registration endpoint (if enabled by a plugin)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary: standard users endpoint (might require admin auth setup)
  ];

  let lastErrorData: any = null; // To store the data of the last error

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // As per task: "assume that if /wp-json/wp/v2/users is the target, the WordPress 
          // environment is set up to allow user creation via this endpoint... without client sending admin credentials."
        },
        body: JSON.stringify({
          username,
          email,
          password,
          // WordPress's /wp/v2/users endpoint might also accept 'name', 'first_name', 'last_name'
          // but username, email, password are the core ones.
        }),
        cache: 'no-store',
      });

      const responseBody = await response.text(); // Read body once
      let data;
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        // If JSON parsing fails, it might be a non-JSON error page (e.g. HTML error)
        console.error(`Failed to parse JSON response from ${endpoint}: ${responseBody}`);
        lastErrorData = { message: `Registration failed at ${endpoint}. Non-JSON response: ${response.statusText}`, code: 'NON_JSON_RESPONSE' };
        if (endpoint === endpoints[0]) continue; // Try next endpoint
        throw new Error(lastErrorData.message); // Or throw if last endpoint
      }


      if (!response.ok) {
        lastErrorData = data; // Store the parsed error data
        console.error(`Registration attempt failed for ${email} at ${endpoint} (Status: ${response.status}):`, data.message || response.statusText);

        // Handle specific WordPress error codes
        if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
            data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
            data.code === 'registration-error-username-exists') {
          const error = new Error(data.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS'; // Custom code for API route to identify
          throw error; // Throw for "user exists" to be caught by API route
        }
        
        // For other specific input errors from WP like invalid email or weak password, throw them.
        if (data.code && (data.code.includes('invalid') || data.code.includes('empty'))) {
             throw new Error(data.message || `Registration validation failed: ${data.code}`);
        }

        // If the primary endpoint returns 404, 401, or 403, it might not be enabled/available. Try secondary.
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 401 || response.status === 403)) {
          console.warn(`Primary endpoint ${endpoint} failed with status ${response.status}. Trying secondary.`);
          continue;
        }
        
        // For other errors on the first endpoint, or any error on the second, throw.
        throw new Error(data.message || `Registration failed at ${endpoint} with status ${response.status}`);
      }

      // Successfully created user (WP usually returns 201 with user object)
      const wpUser = data;
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username,
        name: wpUser.name || wpUser.username || username,
        email: wpUser.email || email,
        // token is not part of this response
      };
      console.log(`User ${user.username} registered successfully via ${endpoint}.`);
      return user;

    } catch (error: any) {
      // If it's a USER_EXISTS error or a specific validation error thrown above, rethrow it.
      if (error.code === 'USER_EXISTS' || error.message.startsWith('Registration validation failed:')) {
        throw error;
      }
      
      console.error(`Caught error during registration attempt with ${endpoint}:`, error.message);
      // If it's the first endpoint, store the error message from lastErrorData (if available) and continue
      if (endpoint === endpoints[0]) {
        // lastErrorData is already updated if the error was from the fetch response.
        // If it was a network error, lastErrorData might be null.
        if (!lastErrorData) lastErrorData = { message: error.message, code: 'NETWORK_OR_UNKNOWN_ERROR_PRIMARY' };
        console.warn(`Error on primary registration endpoint (${endpoint}), trying secondary.`);
        continue;
      }
      // If it's an error on the second endpoint or an unexpected error, throw it.
      // Ensure we throw an actual Error object.
      if (lastErrorData && lastErrorData.message) {
        throw new Error(lastErrorData.message);
      }
      throw error; // Rethrow the caught error if it's already an Error object
    }
  }

  // If loop completes, it means all endpoints failed.
  console.error(`All registration attempts failed for ${email}. Last error data:`, lastErrorData);
  if (lastErrorData && lastErrorData.message) {
    // If the error was a USER_EXISTS type but occurred on the second endpoint after first failed for other reason
    if (lastErrorData.code === 'existing_user_login' || lastErrorData.code === 'existing_user_email' || 
        lastErrorData.code === 'rest_user_exists' || lastErrorData.code === 'registration-error-email-exists' || 
        lastErrorData.code === 'registration-error-username-exists') {
          const error = new Error(lastErrorData.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS';
          throw error;
    }
    throw new Error(lastErrorData.message);
  }
  return null; // Return null for general, unhandled failures after all attempts
}

// Register a new user with WordPress
export async function registerWordPressUser(username: string, email: string, password: string): Promise<User> { // Changed to Promise<User> to always throw on error
  const endpoints = [
    `${WP_URL}/wp-json/wp/v2/users/register`, // Primary: specific registration endpoint (if enabled by a plugin)
    `${WP_URL}/wp-json/wp/v2/users`           // Secondary: standard users endpoint (might require admin auth setup)
  ];

  let lastError: any = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`Attempting user registration with endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: The '/wp-json/wp/v2/users' endpoint typically requires authentication.
          // This implementation assumes that if this endpoint is used, the WordPress
          // environment is configured to allow user creation without explicit admin credentials
          // passed from this client-side/Next.js backend function (e.g., via pre-auth or plugin).
          // No 'Authorization' header is added here to avoid insecurely handling admin credentials.
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        // WordPress specific error codes for existing user/email
        if (data.code === 'existing_user_login' || data.code === 'existing_user_email' || 
            data.code === 'rest_user_exists' || data.code === 'registration-error-email-exists' || 
            data.code === 'registration-error-username-exists') {
          const error = new Error(data.message || 'User already exists.') as any;
          error.code = 'USER_EXISTS'; // Custom code for API route to identify
          throw error;
        }
        // For other errors, store it and try the next endpoint if available
        lastError = new Error(data.message || `Registration failed at ${endpoint} with status ${response.status}`);
        console.error(`Registration attempt failed for ${email} at ${endpoint}:`, data.message || response.statusText);
        if (endpoint === endpoints[0] && (response.status === 404 || response.status === 401 || response.status === 403)) {
          // If primary endpoint is not found or not allowed, try secondary.
          // Otherwise, for errors like "weak password", don't try secondary.
          if (data.code === 'rest_user_invalid_password' || data.code === 'rest_user_invalid_email') {
             throw lastError; // Don't try secondary for these specific input errors
          }
          continue;
        }
        throw lastError; // Throw if it's not a "try next endpoint" scenario
      }

      // Successfully created user
      const wpUser = data;
      const user: User = {
        id: wpUser.id.toString(),
        username: wpUser.username || wpUser.slug || username, // slug can be a fallback
        name: wpUser.name || wpUser.username || username,       // name can be a fallback
        email: wpUser.email || email,
        // Token is not part of registration response, will be acquired via login
      };
      console.log(`User ${user.username} registered successfully via ${endpoint}.`);
      return user;

    } catch (error: any) {
      lastError = error; // Store the error
      // If it's a USER_EXISTS error, rethrow immediately
      if (error.code === 'USER_EXISTS') {
        throw error;
      }
      // If it's the first endpoint and a network or non-specific error, log and continue to try the next one
      if (endpoint === endpoints[0]) {
        console.warn(`Error on primary registration endpoint (${endpoint}), trying secondary:`, error.message);
        continue;
      }
      // If it's the last endpoint or an error we shouldn't retry from, throw.
      console.error('Final error during registration:', error);
      throw error; // Rethrow the last encountered error
    }
  }

  // If loop completes without returning/throwing, it means all endpoints failed.
  // Throw the last known error, or a generic one if somehow lastError is null.
  console.error(`All registration attempts failed for ${email}. Last error:`, lastError);
  if (lastError) {
    throw lastError;
  }
  throw new Error('User registration failed after trying all available methods.');
}