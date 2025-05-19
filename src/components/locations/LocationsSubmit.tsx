import React, { useState } from 'react';
import { useUser } from '@/providers/UserContext'; // Import the user context
import { gql, useMutation } from '@apollo/client'; // Import Apollo Client hooks
import MapSelector from './LocationsSelector'; // Import the MapSelector component

// Define the GraphQL mutation
const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      location {
        id
        title
        lat
        lng
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

  // Use the mutation hook
  // const [createLocation] = useMutation(CREATE_LOCATION, {
  //   onCompleted: () => {
  //     setSuccess('Location created successfully!');
  //     setLocationTitle('');
  //     setLocationDescription('');
  //     setLatitude(null);
  //     setLongitude(null);
  //   //   onClose(); // Close the modal after successful creation
  //   },
  //   onError: (err) => {
  //     setError(err.message);
  //   },
  // });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!latitude || !longitude) {
      setError('Latitude and longitude are required.');
      return;
    }

    try {
      await createLocation({
        variables: {
          input: {
            title: locationTitle,
            lat: latitude,
            lng: longitude,
          },
        },
      });
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