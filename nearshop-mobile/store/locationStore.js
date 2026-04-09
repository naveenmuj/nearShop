import { create } from 'zustand';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { updateLocationProfile } from '../lib/auth';

const STORE_KEY = 'nearshop-location';
const SERVER_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const useLocationStore = create((set, get) => ({
  lat: null,
  lng: null,
  address: null,
  fullAddress: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  preferredRadiusKm: 5,
  lastServerSyncAt: null,
  locationSyncIntervalId: null,
  trackingSubscription: null,

  _persistLocationPayload: async (payload) => {
    try {
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(payload));
    } catch {
      // Keep in-memory state even if persistence fails.
    }
  },

  _setLiveLocationPayload: async ({ latitude, longitude, address = null, fullAddress = null }) => {
    const now = new Date().toISOString();
    const payload = {
      lat: latitude,
      lng: longitude,
      address,
      fullAddress,
      lastUpdated: now,
      preferredRadiusKm: Number(get().preferredRadiusKm || 5),
    };
    set({ ...payload });
    await get()._persistLocationPayload(payload);
    return payload;
  },

  _canSyncToServer: (force = false) => {
    if (force) return true;
    const { lastServerSyncAt } = get();
    if (!lastServerSyncAt) return true;
    return (Date.now() - new Date(lastServerSyncAt).getTime()) >= SERVER_SYNC_INTERVAL_MS;
  },

  syncLocationToServer: async ({ force = false } = {}) => {
    try {
      if (!get()._canSyncToServer(force)) {
        return { success: true, skipped: true, reason: 'throttled' };
      }

      const accessToken = await SecureStore.getItemAsync('access_token');
      if (!accessToken) {
        return { success: false, skipped: true, reason: 'unauthenticated' };
      }

      const state = get();
      if (typeof state.lat !== 'number' || typeof state.lng !== 'number') {
        return { success: false, skipped: true, reason: 'missing_coordinates' };
      }

      await updateLocationProfile({
        latitude: state.lat,
        longitude: state.lng,
        location_address: state.address || null,
        preferred_shop_radius_km: Number(state.preferredRadiusKm || 5),
      });

      const now = new Date().toISOString();
      set({ lastServerSyncAt: now });
      await get()._persistLocationPayload({
        lat: state.lat,
        lng: state.lng,
        address: state.address,
        fullAddress: state.fullAddress,
        lastUpdated: state.lastUpdated,
        preferredRadiusKm: Number(state.preferredRadiusKm || 5),
        lastServerSyncAt: now,
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to sync location profile' };
    }
  },

  // Restore saved location on app start
  initialize: async () => {
    try {
      const saved = await SecureStore.getItemAsync(STORE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const { lat, lng, address, fullAddress, lastUpdated, preferredRadiusKm, lastServerSyncAt } = parsed;
          if (typeof lat === 'number' && typeof lng === 'number') {
            set({
              lat,
              lng,
              address: address || null,
              fullAddress: fullAddress || null,
              lastUpdated: lastUpdated || null,
              preferredRadiusKm: Number(preferredRadiusKm || 5),
              lastServerSyncAt: lastServerSyncAt || null,
            });
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
      let fullAddress = null;
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        address = [geo.name, geo.district || geo.subregion].filter(Boolean).join(', ');
        fullAddress = {
          name: geo.name,
          street: geo.street,
          district: geo.district || geo.subregion,
          city: geo.city,
          region: geo.region,
          postalCode: geo.postalCode,
          country: geo.country,
        };
      } catch { /* coords still usable */ }
      await get()._setLiveLocationPayload({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address,
        fullAddress,
      });
      await get().syncLocationToServer({ force: true });
      set({ isLoading: false });
    } catch (err) {
      const fallback = { lat: 12.935, lng: 77.624, address: 'Koramangala, Bangalore' };
      set({ ...fallback, error: err.message, isLoading: false });
      await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(fallback));
    }
  },

  // Refresh location - gets current GPS position
  refreshLocation: async (options = {}) => {
    const { silent = false, syncToServer = false, skipPermissionPrompt = false } = options;
    if (!silent) {
      set({ isLoading: true, error: null });
    }
    try {
      const permission = skipPermissionPrompt
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
      const status = permission?.status;
      if (status !== 'granted') {
        if (!silent) {
          set({ error: 'Location permission denied', isLoading: false });
        }
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
        lastUpdated: now,
        preferredRadiusKm: Number(get().preferredRadiusKm || 5),
        lastServerSyncAt: get().lastServerSyncAt,
      };
      
      set({ ...payload, isLoading: false });
      await get()._persistLocationPayload(payload);
      if (syncToServer) {
        await get().syncLocationToServer();
      }
      
      return { success: true, ...payload };
    } catch (err) {
      console.error('Location refresh error:', err);
      if (!silent) {
        set({ error: err.message, isLoading: false });
      }
      return { success: false, error: err.message };
    }
  },

  setPreferredRadiusKm: async (radiusKm, options = {}) => {
    const { sync = true } = options;
    const parsed = Number(radiusKm);
    const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : 5;

    const state = get();
    const payload = {
      lat: state.lat,
      lng: state.lng,
      address: state.address,
      fullAddress: state.fullAddress,
      lastUpdated: state.lastUpdated,
      preferredRadiusKm: normalized,
      lastServerSyncAt: state.lastServerSyncAt,
    };

    set({ preferredRadiusKm: normalized });
    await get()._persistLocationPayload(payload);
    if (sync) {
      await get().syncLocationToServer({ force: true });
    }
    return normalized;
  },

  setLocation: async (lat, lng, address = null) => {
    const now = new Date().toISOString();
    set({ lat, lng, address, lastUpdated: now });
    await get()._persistLocationPayload({ lat, lng, address, lastUpdated: now });
  },

  startLiveTracking: async () => {
    const existing = get().trackingSubscription;
    if (existing) return true;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ error: 'Location permission denied' });
        return false;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 15000,
          mayShowUserSettingsDialog: true,
        },
        async (loc) => {
          const latitude = loc?.coords?.latitude;
          const longitude = loc?.coords?.longitude;
          if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

          const state = get();
          const previousLat = state.lat;
          const previousLng = state.lng;
          const hasPrevious = typeof previousLat === 'number' && typeof previousLng === 'number';
          const hasMovedEnough = !hasPrevious
            || Math.abs(previousLat - latitude) > 0.0001
            || Math.abs(previousLng - longitude) > 0.0001;

          if (!hasMovedEnough) return;

          let shortAddress = state.address || null;
          let fullAddress = state.fullAddress || null;

          // Reverse geocode less frequently because it is expensive and can be rate-limited.
          const shouldReverseGeocode =
            !state.lastUpdated
            || (Date.now() - new Date(state.lastUpdated).getTime()) > 120000;

          if (shouldReverseGeocode) {
            try {
              const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
              const parts = [];
              if (geo?.name) parts.push(geo.name);
              if (geo?.district || geo?.subregion) parts.push(geo.district || geo.subregion);
              shortAddress = parts.join(', ') || 'Current Location';
              fullAddress = {
                name: geo?.name,
                street: geo?.street,
                district: geo?.district || geo?.subregion,
                city: geo?.city,
                region: geo?.region,
                postalCode: geo?.postalCode,
                country: geo?.country,
              };
            } catch {
              // Keep previous address if reverse geocode fails.
            }
          }

          await get()._setLiveLocationPayload({
            latitude,
            longitude,
            address: shortAddress,
            fullAddress,
          });

          await get().syncLocationToServer();
        }
      );

      set({ trackingSubscription: subscription, error: null });
      await get().startServerSyncLoop();
      return true;
    } catch (err) {
      set({ error: err?.message || 'Unable to start live location tracking' });
      return false;
    }
  },

  stopLiveTracking: async () => {
    const subscription = get().trackingSubscription;
    if (subscription) {
      try {
        subscription.remove();
      } catch {
        // No-op cleanup.
      }
    }
    await get().stopServerSyncLoop();
    set({ trackingSubscription: null });
  },

  startServerSyncLoop: async () => {
    const existing = get().locationSyncIntervalId;
    if (existing) return;

    const timerId = setInterval(async () => {
      await get().refreshLocation({
        silent: true,
        syncToServer: true,
        skipPermissionPrompt: true,
      });
    }, SERVER_SYNC_INTERVAL_MS);

    set({ locationSyncIntervalId: timerId });
  },

  stopServerSyncLoop: async () => {
    const existing = get().locationSyncIntervalId;
    if (existing) {
      clearInterval(existing);
    }
    set({ locationSyncIntervalId: null });
  },

  clearLocation: async () => {
    await get().stopLiveTracking();
    set({ lat: null, lng: null, address: null, fullAddress: null, lastUpdated: null, lastServerSyncAt: null });
    await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
  },
}));

export default useLocationStore;
