'use client';

import Link from 'next/link';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useUser } from '@/providers/UserContext'; // Import useUser
import styles from './AuthButton.module.scss';

export const AuthButton = () => {
  const { user, isAuthenticated, logout, loading } = useUser();

  if (loading) {
    return (
      <div className={styles.authButton}>
        {/* Basic loading state text, consider a more styled approach if needed */}
        <span className={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className={styles.authButton}>
        <div className={styles.authenticatedContainer}> {/* Container for layout */}
          <span className={styles.welcomeMessage}> {/* Style for welcome message */}
            Welcome, {user.name || user.username}! {/* Display user's name or username */}
          </span>
          <button
            className={`${styles.buttonBase || ''} ${styles.logoutButton}`} // Combine base button style with specific
            onClick={async () => {
              await logout();
              // Optional: Redirect after logout if UserContext's logout doesn't handle it
              // e.g., router.push('/'); 
            }}
            aria-label="Sign Out"
          >
            <FaSignOutAlt />
            <span className={styles.buttonText}>Sign Out</span> {/* Text for clarity */}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authButton}>
      <div className={styles.unauthenticatedContainer}> {/* Container for layout */}
        <Link 
          href="/login" 
          className={`${styles.buttonBase || ''} ${styles.loginButton}`} // Combine base button style
          aria-label="Log In"
        >
          <FaUser />
          <span className={styles.buttonText}>Log In</span> {/* Text for clarity */}
        </Link>
        <Link 
          href="/signup" 
          className={`${styles.buttonBase || ''} ${styles.signupButton}`} // Combine base button style
          aria-label="Sign Up"
        >
          {/* Optionally use a different icon like FaUserPlus, if imported */}
          <span className={styles.buttonText}>Sign Up</span> {/* Text for clarity */}
        </Link>
      </div>
    </div>
  );
};