import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getArtistBySlug } from '@/lib/api/artists';

interface ArtistPageProps {
  params: {
    slug: string;
    locale: string;
  };
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const artist = await getArtistBySlug(params.slug);
  
  if (!artist) {
    return {
      title: 'Artist Not Found',
    };
  }

  return {
    title: `${artist.name} - The Pullup Gallery`,
    description: artist.bio,
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const t = useTranslations('artists');
  const artist = await getArtistBySlug(params.slug);

  if (!artist) {
    notFound();
  }

  return (
    <div className="artist">
      <div className="artist__header">
        <div className="artist__image">
          <Image
            src={artist.imageUrl}
            alt={artist.name}
            width={800}
            height={800}
            className="artist__img"
          />
        </div>
        <div className="artist__info">
          <h1 className="artist__name">{artist.name}</h1>
          <p className="artist__bio">{artist.bio}</p>
          <div className="artist__meta">
            <div className="artist__location">
              <span className="artist__label">{t('location')}</span>
              <span className="artist__value">{artist.location}</span>
            </div>
            <div className="artist__artworks">
              <span className="artist__label">{t('artworks')}</span>
              <span className="artist__value">{artist.artworks.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="artist__artworks">
        <h2 className="artist__section-title">{t('artworks')}</h2>
        <div className="artist__grid">
          {artist.artworks.map((artwork) => (
            <div key={artwork.id} className="artist__artwork">
              <Image
                src={artwork.imageUrl}
                alt={artwork.title}
                width={400}
                height={400}
                className="artist__artwork-img"
              />
              <h3 className="artist__artwork-title">{artwork.title}</h3>
              <p className="artist__artwork-description">{artwork.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 