import { NextResponse } from 'next/server';
import { setAuthCookie } from '@/lib/auth';
import type { User } from '@/lib/types';

// Assume registerWordPressUser exists in @/lib/auth and has the specified signature
// import { registerWordPressUser } from '@/lib/auth'; 

// Mock a simple version of registerWordPressUser for now
async function registerWordPressUser(username: string, email: string, password: string): Promise<User | null> {
  // In a real scenario, this would interact with WordPress
  console.log(`Mock registerWordPressUser called with: ${username}, ${email}, ${password}`);
  if (email === "conflict@example.com") {
    const error = new Error("User already exists") as any;
    error.code = 'USER_EXISTS'; // Custom property to identify the error type
    throw error;
  }
  if (email === "error@example.com") {
    throw new Error("Some other registration error");
  }
  // Simulate a successful registration
  return {
    id: String(Date.now()),
    username,
    email,
    name: username,
    // avatarUrl: 'https://example.com/avatar.png', // Example, not strictly needed for this task
  };
}


export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json({ message: 'Missing required fields (username, email, password)' }, { status: 400 });
    }

    // Validate email format (basic)
    if (!/\S+@\S+\.\S+/.test(email)) {
        return NextResponse.json({ message: 'Invalid email format' }, { status: 400 });
    }

    // Validate password strength (basic example: at least 6 characters)
    if (password.length < 6) {
        return NextResponse.json({ message: 'Password must be at least 6 characters long' }, { status: 400 });
    }


    let newUser: User | null;
    try {
      newUser = await registerWordPressUser(username, email, password);
    } catch (error: any) {
      if (error.code === 'USER_EXISTS') { // Check for the custom error code
        return NextResponse.json({ message: 'User already exists' }, { status: 409 });
      }
      console.error('Registration error:', error);
      return NextResponse.json({ message: 'Error registering user', error: error.message || 'Unknown error' }, { status: 500 });
    }

    if (!newUser) {
      // This case might be redundant if registerWordPressUser always throws an error on failure,
      // but it's good for robustness.
      return NextResponse.json({ message: 'Registration failed for an unknown reason' }, { status: 500 });
    }

    // Set auth cookie for the new user
    const response = NextResponse.json(
      {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        // avatarUrl: newUser.avatarUrl, // Include if present and desired
      },
      { status: 201 }
    );

    await setAuthCookie(response, {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        name: newUser.name,
        // Include other necessary fields for the session, but not sensitive ones like tokens directly from WP if any
    } as User); // Cast to User, assuming setAuthCookie expects a User object or similar structure

    return response;

  } catch (error: any) {
    console.error('Signup endpoint error:', error);
    if (error instanceof SyntaxError) { // JSON parsing error
        return NextResponse.json({ message: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ message: 'An unexpected error occurred', error: error.message || 'Unknown error' }, { status: 500 });
  }
}
