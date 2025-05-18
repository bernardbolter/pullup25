import { gql } from '@apollo/client';
import { client } from './client';

const GET_LOCATIONS = gql`
  query GetLocations {
    locations {
      id
      title
      description
      imageUrl
      slug
      artworksCount
      distance
      coordinates {
        latitude
        longitude
      }
    }
  }
`;

const GET_LOCATION_BY_SLUG = gql`
  query GetLocationBySlug($slug: String!) {
    locationBySlug(slug: $slug) {
      id
      title
      description
      imageUrl
      slug
      artworksCount
      distance
      coordinates {
        latitude
        longitude
      }
      artworks {
        id
        title
        description
        imageUrl
        artist {
          id
          name
          slug
        }
      }
    }
  }
`;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  artworksCount: number;
  distance?: string;
}

export async function getLocations(): Promise<Location[]> {
  // TODO: Implement GraphQL query to fetch locations
  // For now, return mock data
  return [
    {
      id: '1',
      title: 'Downtown Gallery',
      slug: 'downtown-gallery',
      description: 'A vibrant art space in the heart of the city',
      imageUrl: '/images/locations/downtown.jpg',
      latitude: 40.7128,
      longitude: -74.0060,
      artworksCount: 15,
      distance: '0.5 km',
    },
    {
      id: '2',
      title: 'Riverside Studio',
      slug: 'riverside-studio',
      description: 'Contemporary art exhibitions with a view of the river',
      imageUrl: '/images/locations/riverside.jpg',
      latitude: 40.7589,
      longitude: -73.9851,
      artworksCount: 8,
      distance: '1.2 km',
    },
  ];
}

export async function getLocationBySlug(slug: string): Promise<Location | null> {
  const locations = await getLocations();
  return locations.find(location => location.slug === slug) || null;
} 