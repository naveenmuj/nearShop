import { create } from 'zustand';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'nearshop-location';

const useLocationStore = create((set) => ({
  lat: null,
  lng: null,
  address: null,
  isLoading: false,
  error: null,

  // Restore saved location on app start
  initialize: async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORE_KEY);
      if (saved) {
        const { lat, lng, address } = JSON.parse(saved);
        if (lat && lng) {
          set({ lat, lng, address: address || null });
          return;
        }
      }
    } catch {
      // ignore
    }
  },

  requestLocation: async () => {
    set({ isLoading: true, error: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const fallback = { lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore' };
        set({ ...fallback, error: 'Permission denied', isLoading: false });
        await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(fallback));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address = null;
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        address = [geo.name, geo.district || geo.subregion].filter(Boolean).join(', ');
      } catch { /* coords still usable */ }
      const payload = { lat: loc.coords.latitude, lng: loc.coords.longitude, address };
      set({ ...payload, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(payload));
    } catch (err) {
      const fallback = { lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore' };
      set({ ...fallback, error: err.message, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(fallback));
    }
  },

  setLocation: async (lat, lng, address = null) => {
    set({ lat, lng, address });
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ lat, lng, address }));
    } catch { /* in-memory state still set */ }
  },

  clearLocation: async () => {
    set({ lat: null, lng: null, address: null });
    await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
  },
}));

export default useLocationStore;
