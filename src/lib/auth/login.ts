/**
 * Logs in a user and retrieves a JWT token.
 * @param {string} username - The username of the user.
 * @param {string} password - The password of the user.
 * @returns {Promise<string>} - A promise that resolves to the JWT token.
 */
export async function login(username: string, password: string): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_API_URL}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    console.log('JWT Token:', data.token); // Log the token for debugging
    return data.token; // Return the token for further use
  } catch (error) {
    console.error('Error logging in:', error);
    throw error; // Rethrow the error for handling in the calling function
  }
}
