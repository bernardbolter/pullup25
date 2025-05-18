'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Location } from '@/lib/api/locations';
import { useGeolocation } from '@/hooks/useGeolocation';

const Map = dynamic(() => import('@/components/map/Map'), {
  
  ssr: false,
  loading: () => (
    <div className="map map--loading">
      <div className="map__loading">...loading</div>
    </div>
  ),
});

interface LocationsClientProps {
  locations: Location[];
}

const LocationsClient = ({ locations }: LocationsClientProps) => {
  const t = useTranslations('locations');
  const [searchQuery, setSearchQuery] = useState('');
  const { latitude, longitude, error: locationError } = useGeolocation();

  const filteredLocations = locations.filter(location =>
    location.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="locations">
      <div className="locations__header">
        <h1 className="locations__title">{t('title')}</h1>
        <div className="locations__search">
          <input
            type="search"
            placeholder={t('search')}
            className="locations__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="locations__content">
        <div className="locations__map">
          <Map
            locations={filteredLocations}
            userLocation={latitude && longitude ? { latitude, longitude } : undefined}
          />
        </div>

        <div className="locations__grid">
          {filteredLocations.length > 0 ? (
            filteredLocations.map((location) => (
              <Link
                key={location.id}
                href={`/locations/${location.slug}`}
                className="location-card"
              >
                <div className="location-card__image">
                  <Image
                    src={location.imageUrl}
                    alt={location.title}
                    width={600}
                    height={400}
                    className="location-card__img"
                  />
                </div>
                <div className="location-card__content">
                  <h3 className="location-card__title">{location.title}</h3>
                  <p className="location-card__description">{location.description}</p>
                  <div className="location-card__meta">
                    <span className="location-card__artworks">
                      {t('artworksCount', { count: location.artworksCount })}
                    </span>
                    <span className="location-card__distance">
                      {location.distance}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="locations__empty">
              <p>{t('noLocations')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="locations__submit">
        <button className="button button--primary">
          {t('submit')}
        </button>
      </div>
    </div>
  );
};

export default LocationsClient; 