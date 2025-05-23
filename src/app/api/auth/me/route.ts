import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth'; // Corrected path as per initial successful creation of other files
import type { User } from '@/lib/types'; // Corrected path as per initial successful creation of other files

export async function GET(request: Request) {
  try {
    // Call getCurrentUser, assuming it processes the token from cookies in the request
    const currentUser: User | null = await getCurrentUser(request);

    if (currentUser) {
      // Respond with non-sensitive user data, similar to login/signup
      const { id, username, name, email } = currentUser;
      return NextResponse.json({ id, username, name, email }, { status: 200 });
    } else {
      // No valid session or user could not be determined from token
      return NextResponse.json({ message: 'Unauthorized: No valid session found or user could not be determined.' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Error in /api/auth/me endpoint:', error);
    // Avoid sending detailed error messages to the client in production
    return NextResponse.json({ message: 'Internal Server Error', error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
