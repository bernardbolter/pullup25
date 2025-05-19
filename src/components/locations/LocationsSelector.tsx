'use client'

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapSelectorProps {
    onSelect: (lat: number, lng: number) => void; // Callback to handle selected coordinates
  }

  const MapSelector: React.FC<MapSelectorProps> = ({ onSelect }) => {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const mapRefInstance = useRef<L.Map | null>(null); // Store the map instance
  
    useEffect(() => {
        console.log(mapRef.current);
      if (mapRef.current && !mapRefInstance.current) {
        // Initialize the map only if it hasn't been initialized yet
        mapRefInstance.current = L.map(mapRef.current).setView([52.48215971879987, 13.433774189335354], 13); // Default view with zoom level
  
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(mapRefInstance.current);
  
        // Handle map click event
        mapRefInstance.current.on('click', (event) => {
          const { lat, lng } = event.latlng;
          console.log(lat, lng);
          onSelect(lat, lng); // Call the onSelect callback with the coordinates
        });
      }
  
      return () => {
        if (mapRefInstance.current) {
          mapRefInstance.current.off(); // Clean up event listeners
          mapRefInstance.current.remove(); // Remove the map instance
          mapRefInstance.current = null; // Clear the reference
        }
      };
    }, [onSelect]);
  
    return (
      <div>
        <div ref={mapRef} style={{ height: '400px', width: '100%' }} />
      </div>
    );
  };
  
  export default MapSelector;