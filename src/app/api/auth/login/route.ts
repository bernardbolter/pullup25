import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithWordPress, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    // Authenticate with WordPress
    const user = await authenticateWithWordPress(username, password);

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Set auth token in cookies
    setAuthCookie(user);

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Authentication failed' }, { status: 500 });
  }
}