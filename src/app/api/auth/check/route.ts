import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyWordPressToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get current user from token
    const user = getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Verify WordPress token is still valid
    const isValid = await verifyWordPressToken(user.token);

    if (!isValid) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ 
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}