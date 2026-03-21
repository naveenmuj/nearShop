import { create } from 'zustand';
import * as Location from 'expo-location';

const useLocationStore = create((set) => ({
  lat: null,
  lng: null,
  address: null,
  isLoading: false,
  error: null,

  requestLocation: async () => {
    set({ isLoading: true, error: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Default to Bangalore Koramangala
        set({ lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore', error: 'Permission denied', isLoading: false });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      // Try reverse geocode
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        const address = [geo.name, geo.district || geo.subregion].filter(Boolean).join(', ');
        set({ lat: loc.coords.latitude, lng: loc.coords.longitude, address, isLoading: false });
      } catch {
        set({ lat: loc.coords.latitude, lng: loc.coords.longitude, isLoading: false });
      }
    } catch (err) {
      set({ lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore', error: err.message, isLoading: false });
    }
  },
}));

export default useLocationStore;
