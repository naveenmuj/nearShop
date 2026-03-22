import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Navigation, Search, X, Loader2, ChevronRight } from 'lucide-react'
import { useLocationStore } from '../store/locationStore'
import { searchLocations, reverseGeocode } from '../api/geocoding'

export default function LocationPicker({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const { setLocation } = useLocationStore()

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const handleSearch = useCallback((val) => {
    setQuery(val)
    setError('')
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await searchLocations(val)
        setResults(found)
      } catch {
        setError('Search failed. Check your internet.')
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [])

  const handleSelect = (lat, lng, name) => {
    setLocation(lat, lng, name)
    onClose()
  }

  const handleGPS = () => {
    setError('')
    setGpsLoading(true)
    if (!navigator.geolocation) {
      setError('GPS not available in your browser.')
      setGpsLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const name = await reverseGeocode(lat, lng).catch(() => null)
        setLocation(lat, lng, name || 'Current location')
        setGpsLoading(false)
        onClose()
      },
      (err) => {
        setGpsLoading(false)
        if (err.code === 1) {
          setError('Location permission denied. Please allow location access in your browser settings.')
        } else {
          setError('Could not get your location. Try searching manually.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const POPULAR = [
    { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
    { name: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295 },
    { name: 'Koramangala, Bengaluru', lat: 12.9279, lng: 77.6271 },
    { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 },
    { name: 'Hitech City, Hyderabad', lat: 17.4477, lng: 78.3760 },
    { name: 'Salt Lake, Kolkata', lat: 22.5726, lng: 88.4158 },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#5B2BE7]/10 rounded-xl flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[#5B2BE7]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Set your location</h2>
              <p className="text-xs text-gray-400">To find shops near you</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search area, street, city..."
              className="w-full pl-10 pr-10 py-3.5 bg-gray-100 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#5B2BE7]/20 border border-transparent focus:border-[#5B2BE7]/30 transition-all"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>

          {/* Use GPS */}
          <button
            onClick={handleGPS}
            disabled={gpsLoading}
            className="w-full flex items-center gap-3 p-4 bg-[#5B2BE7]/5 border-2 border-[#5B2BE7]/20 rounded-2xl hover:bg-[#5B2BE7]/10 hover:border-[#5B2BE7]/30 transition-all disabled:opacity-60 text-left active:scale-[0.98]"
          >
            {gpsLoading ? (
              <Loader2 className="w-5 h-5 text-[#5B2BE7] animate-spin flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 bg-[#5B2BE7] rounded-xl flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-[#5B2BE7]">
                {gpsLoading ? 'Getting your location...' : 'Use current location'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Auto-detect using GPS</p>
            </div>
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm p-3.5 rounded-2xl">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Search results */}
          {searching && (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Search Results</p>
              <div className="space-y-1">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(r.lat, r.lng, r.name)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 rounded-2xl transition-colors text-left group active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#5B2BE7]/10 transition-colors">
                      <MapPin className="w-4 h-4 text-gray-500 group-hover:text-[#5B2BE7] transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{r.fullName?.split(',').slice(0, 3).join(',')}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#5B2BE7] transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">📍</p>
              <p className="text-sm font-semibold text-gray-700">No results found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different area or city name</p>
            </div>
          )}

          {/* Popular locations (shown when no query) */}
          {!query && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Popular Cities</p>
              <div className="space-y-1">
                {POPULAR.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(p.lat, p.lng, p.name)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 rounded-2xl transition-colors text-left group active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#5B2BE7]/10 transition-colors">
                      <span className="text-sm">🏙️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 truncate">{p.name}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#5B2BE7] transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
