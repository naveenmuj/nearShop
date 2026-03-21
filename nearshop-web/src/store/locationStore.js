import { create } from 'zustand'

export const useLocationStore = create((set) => ({
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
      (pos) => set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, isLoading: false }),
      (err) => set({ isLoading: false, error: err.message }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  },

  setLocation: (lat, lng, name = '') => set({ latitude: lat, longitude: lng, locationName: name }),
}))
