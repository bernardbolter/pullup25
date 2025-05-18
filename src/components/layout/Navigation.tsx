'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';

const Navigation = () => {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <nav className="navigation">
      <div className="navigation__left">
        <Link href="/" className="navigation__logo">
          {t('home')}
        </Link>
      </div>

      <div className="navigation__center">
        <Link
          href="/locations"
          className={`navigation__link ${isActive('/locations') ? 'navigation__link--active' : ''}`}
        >
          {t('locations')}
        </Link>
        <Link
          href="/artists"
          className={`navigation__link ${isActive('/artists') ? 'navigation__link--active' : ''}`}
        >
          {t('artists')}
        </Link>
        <Link
          href="/about"
          className={`navigation__link ${isActive('/about') ? 'navigation__link--active' : ''}`}
        >
          {t('about')}
        </Link>
      </div>

      <div className="navigation__right">
        <LanguageSwitcher />
      </div>
    </nav>
  );
};

export default Navigation; 