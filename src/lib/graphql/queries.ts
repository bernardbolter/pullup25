import { gql } from '@apollo/client';

export const GET_LOCATIONS = gql`
  query GetLocations {
    pullupLocations {
      nodes {
        id
        title
        content
        locationMeta {
          latitude
          longitude
          image {
            sourceUrl
          }
        }
      }
    }
  }
`;

export const GET_ARTISTS = gql`
  query GetArtists {
    pullupArtists {
      nodes {
        id
        title
        content
        artistMeta {
          location
          artwork {
            sourceUrl
          }
        }
      }
    }
  }
`;

export const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreatePullupLocationInput!) {
    createPullupLocation(input: $input) {
      pullupLocation {
        id
        title
      }
    }
  }
`;

export const CREATE_ARTIST = gql`
  mutation CreateArtist($input: CreatePullupArtistInput!) {
    createPullupArtist(input: $input) {
      pullupArtist {
        id
        title
      }
    }
  }
`; 