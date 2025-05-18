import { Metadata } from 'next';
import { getArtists } from '@/lib/api/artists';
import ArtistsClient from '@/components/artists/ArtistsClient';

export const metadata: Metadata = {
  title: 'Artists - The Pullup Gallery',
  description: 'Discover featured artists and their works in augmented reality',
};

export default async function ArtistsPage() {
  const artists = await getArtists();

  return <ArtistsClient artists={artists} />;
}