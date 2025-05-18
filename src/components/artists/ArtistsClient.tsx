'use client';

import { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import ArtistCard from '@/components/artists/ArtistCard';
import { Artist, getArtists } from '@/lib/api/artists';
import { AuthButton } from '@/components/auth/AuthButton';
import { isAuthenticated } from '@/lib/graphql-client';

export const metadata: Metadata = {
  title: 'Artists - The Pullup Gallery',
  description: 'Discover featured artists and their works in augmented reality',
};

interface ArtistsClientProps {
    artists: Artist[];
  }

const ArtistsClient: React.FC<ArtistsClientProps> = ({ artists }) => {
  console.log(artists);
  const t = useTranslations('artists');
  const authenticated = isAuthenticated();
  console.log(authenticated);

  return (
    <div className="artists">
      <div className="artists__header">
        <h1 className="artists__title">{t('title')}</h1>
        <div className="artists__search">
          <input
            type="search"
            placeholder={t('search')}
            className="artists__search-input"
          />
        </div>
      </div>

      <div className="artists__grid">
        {artists.length > 0 ? (
          artists.map((artist) => (
            <ArtistCard
              key={artist.id}
              id={artist.id}
              title={artist.title}
              slug={artist.slug}
            />
          ))
        ) : (
          <div className="artists__empty">
            <p>{t('noArtists')}</p>
          </div>
        )}
      </div>

      <div className="artists__submit">
        <button className="button button--primary">
          {t('submit')}
        </button>
      </div>

      <AuthButton />
    </div>
  );
}

export default ArtistsClient;