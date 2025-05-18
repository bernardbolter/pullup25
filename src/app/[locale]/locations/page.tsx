import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getLocations } from '@/lib/api/locations';
import LocationsClient from '@/components/locations/LocationsClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('locations');
  
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocationsPage() {
  const locations = await getLocations();
  
  return <LocationsClient locations={locations} />;
} 