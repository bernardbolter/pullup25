// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { authenticateWithWordPress, setAuthCookie } from '@/lib/auth';
import { User } from '@/lib/types'; // Ensure User type is appropriate

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await authenticateWithWordPress(username, password);

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials or WordPress authentication failed' }, { status: 401 });
    }

    // Set the custom JWT cookie
    setAuthCookie(user); // This function is server-side and uses next/headers cookies

    // Return user information (excluding sensitive data like the token)
    const clientUser: Omit<User, 'token'> = { // Or pick specific fields
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
    };

    return NextResponse.json(clientUser);
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error && error.message.includes('Authentication failed')) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error during login' }, { status: 500 });
  }
}
