import React, { useState } from 'react';
import { useUser } from '@/providers/UserContext'; // Import the user context
import { gql } from '@apollo/client'; // Import Apollo Client hooks
import client from '@/lib/graphql/client';
import MapSelector from './LocationsSelector'; // Import the MapSelector component

// Define the GraphQL mutation
const CREATE_PULLUP_LOCATION = gql`
  mutation CreatePullupLocation($input: CreatePullupLocationInput!) {
    createPullupLocation(input: $input) {
      pullupLocation {  
        id  
        title  
      }
    }
  }
`;

interface LocationsSubmitProps {
  onClose: () => void; // Function to close the modal
}

const LocationsSubmit: React.FC<LocationsSubmitProps> = ({ onClose }) => {
  const { user } = useUser(); // Get user info from context
  const [locationTitle, setLocationTitle] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // const [createCustomPost] = useMutation(CREATE_PULLUP_LOCATION);

  const handleCreatePullupLocation = async (input: { title: string; content?: string }) => {
    const token = localStorage.getItem('auth_token'); // Get the token from local storage

    if (!token) {
      console.log('No token found');
      return;
    }
  
    try {
      const { data } = await client.mutate({
        mutation: CREATE_PULLUP_LOCATION,
        variables: {
          input: {
            title: locationTitle,
          },
        },
        context: {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the headers
          },
        },
      });
  
      console.log('Post created:', data);
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
   

    // if (!latitude || !longitude) {
    //   setError('Latitude and longitude are required.');
    //   return;
    // }

    try {
      await handleCreatePullupLocation({ title: locationTitle });
    } catch (err) {
      console.error('Error creating location:', err);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="modalContent">
        <h2>Locations Submit</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="locationTitle">Location Title:</label>
            <input
              type="text"
              id="locationTitle"
              value={locationTitle}
              onChange={(e) => setLocationTitle(e.target.value)}
              required
            />
          </div>
          <MapSelector onSelect={(lat: number, lng: number) => {
            setLatitude(lat);
            setLongitude(lng);
          }} />
          <p>{latitude} {longitude}</p>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          <button type="submit">Submit</button>
        </form>
        <button onClick={onClose} className="closeButton">
          Close
        </button>
      </div>
    </div>
  );
};

export default LocationsSubmit;