import { useEffect } from 'react'
import { useLocationStore } from '../store/locationStore'

export function useLocation() {
  const store = useLocationStore()

  useEffect(() => {
    if (!store.latitude && !store.isLoading) {
      store.requestLocation()
    }
  }, [])

  return store
}
