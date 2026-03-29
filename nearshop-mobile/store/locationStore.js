import { create } from 'zustand';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'nearshop-location';

const useLocationStore = create((set, get) => ({
  lat: null,
  lng: null,
  address: null,
  isLoading: false,
  error: null,
  lastUpdated: null,

  // Restore saved location on app start
  initialize: async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORE_KEY);
      if (saved) {
        try {
          const { lat, lng, address, lastUpdated } = JSON.parse(saved);
          if (lat && lng) {
            set({ lat, lng, address: address || null, lastUpdated: lastUpdated || null });
            return;
          }
        } catch (parseErr) {
          console.warn('Corrupted location data, clearing:', parseErr.message);
          await SecureStore.deleteItemAsync(STORE_KEY);
        }
      }
    } catch (err) {
      console.error('Location initialization error:', err);
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
      const now = new Date().toISOString();
      const payload = { lat: loc.coords.latitude, lng: loc.coords.longitude, address, lastUpdated: now };
      set({ ...payload, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(payload));
    } catch (err) {
      const fallback = { lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore' };
      set({ ...fallback, error: err.message, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(fallback));
    }
  },

  // Refresh location - gets current GPS position
  refreshLocation: async () => {
    set({ isLoading: true, error: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ error: 'Location permission denied', isLoading: false });
        return { success: false, error: 'Permission denied' };
      }
      
      const loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.High,
        // Ensure we get fresh location, not cached
        maximumAge: 5000,
      });
      
      let address = null;
      let fullAddress = null;
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        // Build comprehensive address
        const parts = [];
        if (geo.name) parts.push(geo.name);
        if (geo.street) parts.push(geo.street);
        if (geo.district || geo.subregion) parts.push(geo.district || geo.subregion);
        if (geo.city) parts.push(geo.city);
        
        address = parts.slice(0, 2).join(', ') || 'Current Location';
        fullAddress = {
          name: geo.name,
          street: geo.street,
          district: geo.district || geo.subregion,
          city: geo.city,
          region: geo.region,
          postalCode: geo.postalCode,
          country: geo.country,
        };
      } catch (geoErr) { 
        console.warn('Reverse geocoding failed:', geoErr);
        address = 'Current Location';
      }
      
      const now = new Date().toISOString();
      const payload = { 
        lat: loc.coords.latitude, 
        lng: loc.coords.longitude, 
        address, 
        fullAddress,
        lastUpdated: now 
      };
      
      set({ ...payload, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(payload));
      
      return { success: true, ...payload };
    } catch (err) {
      console.error('Location refresh error:', err);
      set({ error: err.message, isLoading: false });
      return { success: false, error: err.message };
    }
  },

  setLocation: async (lat, lng, address = null) => {
    const now = new Date().toISOString();
    set({ lat, lng, address, lastUpdated: now });
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify({ lat, lng, address, lastUpdated: now }));
    } catch { /* in-memory state still set */ }
  },

  clearLocation: async () => {
    set({ lat: null, lng: null, address: null, lastUpdated: null });
    await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
  },
}));

export default useLocationStore;
