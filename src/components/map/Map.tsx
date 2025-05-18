import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Location } from '@/lib/api/locations';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  locations: Location[];
  onLocationSelect?: (location: Location) => void;
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}

const Map = ({ locations, onLocationSelect, userLocation }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [markers, setMarkers] = useState<L.Marker[]>([]);
  const t = useTranslations('locations');

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const mapInstance = L.map(mapRef.current).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    const newMarkers: L.Marker[] = [];

    // Add location markers
    locations.forEach(location => {
      const marker = L.marker([
        location.latitude,
        location.longitude
      ]).addTo(map);

      marker.bindPopup(`
        <div class="map-popup">
          <h3>${location.title}</h3>
          <p>${location.description}</p>
          <span>${t('artworksCount', { count: location.artworksCount })}</span>
        </div>
      `);

      if (onLocationSelect) {
        marker.on('click', () => onLocationSelect(location));
      }

      newMarkers.push(marker);
    });

    // Add user location marker if available
    if (userLocation) {
      const userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div class="user-location-dot"></div>'
        })
      }).addTo(map);
      newMarkers.push(userMarker);
    }

    setMarkers(newMarkers);

    // Fit map bounds to show all markers
    if (newMarkers.length > 0) {
      const group = L.featureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [map, locations, userLocation, onLocationSelect, t]);

  return (
    <div className="map">
      <div ref={mapRef} className="map__container" />
    </div>
  );
};

export default Map; 