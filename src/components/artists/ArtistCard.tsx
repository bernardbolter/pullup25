import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface ArtistCardProps {
  id: string;
  title: string;
  slug: string;
}

const ArtistCard = ({ id, title, slug }: ArtistCardProps) => {
  const t = useTranslations('artists');

  return (
    <Link href={`/artists/${slug}`} className="artist-card">
      <div className="artist-card__image">
        {/* <Image
          src={imageUrl}
          alt={name}
          width={400}
          height={400}
          className="artist-card__img"
        /> */}
      </div>
      <div className="artist-card__content">
        <h3 className="artist-card__name">{title}</h3>
        <p className="artist-card__bio">{slug}</p>
        <span className="artist-card__link">{t('viewProfile')}</span>
      </div>
    </Link>
  );
};

export default ArtistCard; 