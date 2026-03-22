import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLocationStore = create(
  persist(
    (set) => ({
      latitude: null,
      longitude: null,
      locationName: '',
      isLoading: false,
      error: null,

      requestLocation: () => {
        set({ isLoading: true, error: null })
        if (!navigator.geolocation) {
          set({ isLoading: false, error: 'Geolocation not supported' })
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords
            set({ latitude, longitude, isLoading: false })
            // Auto reverse-geocode the address name
            try {
              const { reverseGeocode } = await import('../api/geocoding')
              const name = await reverseGeocode(latitude, longitude)
              if (name) set({ locationName: name })
            } catch {
              // silently skip — coords are still set
            }
          },
          (err) => set({ isLoading: false, error: err.message }),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      },

      setLocation: (lat, lng, name = '') => set({ latitude: lat, longitude: lng, locationName: name }),

      clearLocation: () => set({ latitude: null, longitude: null, locationName: '' }),
    }),
    {
      name: 'nearshop-location', // localStorage key
      // Only persist coords + name, not transient loading/error state
      partialize: (s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
        locationName: s.locationName,
      }),
    }
  )
)
