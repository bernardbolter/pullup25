// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() { // Changed to POST as per best practices for actions that change state
  try {
    clearAuthCookie(); // This function is server-side
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal Server Error during logout' }, { status: 500 });
  }
}
