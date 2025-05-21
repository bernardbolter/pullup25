'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';
import styles from './AuthButton.module.scss';
import { useAuth } from '@/lib/providers'

// import { useUser } from '@/providers/UserContext';
import { isAuthenticated, removeAuthToken } from '@/lib/graphql-client';

export const AuthButton = () => {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);
  const theAuth = useAuth();
  console.log(theAuth.user)


  if (isAuthenticated()) {
    return (
      <div className={styles.authButton}>
        <div className={styles.authenticated}>
          {/* <span className={styles.email}>{user?.email}</span> */}
          <button
            className={styles.logoutButton}
            onClick={() => console.log('logout')}
            aria-label={t('logout')}
          >
            <FaSignOutAlt />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authButton}>
      <Link
        href="/signup"
        className={styles.loginButton}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={t('signup')}
      >
        <FaUser />
        {showTooltip && (
          <div className={styles.tooltip}>
            {t('loginOrSignup')}
          </div>
        )}
      </Link>
    </div>
  );
}; 