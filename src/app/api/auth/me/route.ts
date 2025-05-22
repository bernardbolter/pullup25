// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser, WP_URL, verifyWordPressToken } from '@/lib/auth'; // Assuming WP_URL and verifyWordPressToken might be needed or are part of a broader auth strategy.
import { User } from '@/lib/types'; // Ensure User type is appropriate

export async function GET() {
  try {
    const currentUser = getCurrentUser(); // From your lib/auth.ts, reads the custom JWT

    if (!currentUser || !currentUser.token) { // currentUser.token should be the wpToken
      return NextResponse.json({ error: 'Unauthorized: No active session or token missing' }, { status: 401 });
    }

    // Fetch fresh user details from WordPress using the stored WP token
    const response = await fetch(`${WP_URL}/wp-json/wp/v2/users/me?context=edit`, { // context=edit might be needed for email
      headers: {
        'Authorization': `Bearer ${currentUser.token}`, // currentUser.token is the WordPress token
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Ensure fresh data
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WordPress user fetch error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch user data from WordPress', details: errorData }, { status: response.status });
    }

    const wpUserData = await response.json();

    // Construct the user object to return to the client
    // Ensure this matches the User interface in UserContext.tsx
    const user: User = {
      id: wpUserData.id.toString(), // Ensure ID is a string if your User interface expects it
      username: wpUserData.slug, // 'slug' is often the username, 'name' is the display name
      name: wpUserData.name,
      email: wpUserData.email,
      // Do not send back the token to the client from this route
    };

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
