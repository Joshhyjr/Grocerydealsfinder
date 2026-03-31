import { useState } from 'react';
import { reverseGeocodeLocation, resolveLocationInput } from '../data/api';

export function useLocationInput(initialValue = '') {
  const [locationInput, setLocationInput] = useState(initialValue);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  const resolveLocation = async () => {
    setIsResolvingLocation(true);

    try {
      const location = await resolveLocationInput(locationInput);
      // Once a location resolves successfully, we store the friendly label so
      // the form reflects the place the user actually searched for.
      setLocationInput(location.input);
      return location;
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported in this browser.');
    }

    setIsResolvingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const location = await reverseGeocodeLocation(
        position.coords.latitude,
        position.coords.longitude,
      );
      setLocationInput(location.label);
      return location;
    } catch (error) {
      // Browser geolocation errors are not always real class instances, so we
      // detect them by shape before turning them into consistent UI copy.
      if (typeof error === 'object' && error !== null && 'code' in error) {
        throw new Error('Allow location access to autofill your nearby postal code.');
      }
      throw error;
    } finally {
      setIsResolvingLocation(false);
    }
  };

  return {
    locationInput,
    setLocationInput,
    isResolvingLocation,
    resolveLocation,
    useCurrentLocation,
  };
}
