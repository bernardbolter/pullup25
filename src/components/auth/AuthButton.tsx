'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';
import styles from './AuthButton.module.scss';

interface AuthButtonProps {
  userEmail?: string;
  isAuthenticated?: boolean;
  onLogout?: () => void;
}

export const AuthButton = ({
  userEmail,
  isAuthenticated = false,
  onLogout,
}: AuthButtonProps) => {
  const t = useTranslations('Auth');
  const [showTooltip, setShowTooltip] = useState(false);

  if (isAuthenticated && userEmail) {
    return (
      <div className={styles.authButton}>
        <div className={styles.authenticated}>
          <span className={styles.email}>{userEmail}</span>
          <button
            className={styles.logoutButton}
            onClick={onLogout}
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