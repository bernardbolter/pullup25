import { gql } from '@apollo/client';
import { client } from './client';

const GET_ARTIST_BY_SLUG = gql`
  query GetArtistBySlug($slug: String!) {
    artistBySlug(slug: $slug) {
      id
      name
      bio
      imageUrl
      location
      slug
      artworks {
        id
        title
        description
        imageUrl
      }
    }
  }
`;

const GET_ARTISTS = gql`
  query GetArtists {
    pullupArtists {
      nodes {
        title(format: RENDERED)
        slug
        id
      }
    }
  }
`;

export interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
}

export interface Artist {
  slug: string;
  title: string;
  id: string;
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  try {
    const { data } = await client.query({
      query: GET_ARTIST_BY_SLUG,
      variables: { slug },
    });
    return data.artistBySlug;
  } catch (error) {
    console.error('Error fetching artist:', error);
    return null;
  }
}

export async function getArtists(): Promise<Artist[]> {
  try {
    const { data } = await client.query({
      query: GET_ARTISTS,
    });
    return data.pullupArtists.nodes;
  } catch (error) {
    console.error('Error fetching artists:', error);
    return [];
  }
} 