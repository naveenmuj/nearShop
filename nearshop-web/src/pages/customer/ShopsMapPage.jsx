import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Star, Navigation, List, Map as MapIcon, X, Clock, Truck,
  ChevronUp, ChevronDown, Store, Search, Locate, ZoomIn, ZoomOut, ExternalLink
} from 'lucide-react'
import { getNearbyShops } from '../../api/shops'
import { useLocationStore } from '../../store/locationStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import api from '../../api/client'
import { PageTransition } from '../../components/ui/PageTransition'

// ---------------------------------------------------------------------------
// Haversine distance (km) -- used as a client-side fallback when the API
// does not return distance_km on shop objects.
// ---------------------------------------------------------------------------
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ---------------------------------------------------------------------------
// Custom pulsing user-location marker (pure CSS, injected once)
// ---------------------------------------------------------------------------
const USER_MARKER_CSS = `
.user-location-pulse {
  width: 18px; height: 18px;
  background: #3b82f6;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(59,130,246,.5);
  animation: pulse-ring 2s cubic-bezier(.4,0,.6,1) infinite;
  position: relative;
  z-index: 1000;
}
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(59,130,246,.5) }
  70%  { box-shadow: 0 0 0 14px rgba(59,130,246,0) }
  100% { box-shadow: 0 0 0 0 rgba(59,130,246,0) }
}
.shop-marker-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #7c3aed;
  border: 3px solid #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
  color: #fff; font-size: 16px;
  transition: transform .2s, box-shadow .2s;
  cursor: pointer;
}
.shop-marker-icon.selected {
  background: #db2777;
  transform: scale(1.3);
  box-shadow: 0 4px 16px rgba(219,39,119,.45);
  z-index: 1100 !important;
}
.leaflet-popup-content-wrapper {
  border-radius: 12px !important;
  box-shadow: 0 8px 30px rgba(0,0,0,.12) !important;
  padding: 0 !important;
}
.leaflet-popup-content { margin: 0 !important; }
.leaflet-popup-tip { display: none !important; }
`

// ---------------------------------------------------------------------------
// Fallback List View -- shown when map feature is disabled or Leaflet missing
// ---------------------------------------------------------------------------
function FallbackListView({ shops, loading, navigate, latitude, longitude }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 pb-24">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 animate-fade-in-up">Shops Near You</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 animate-fade-in-up" style={{animationDelay: '50ms"}}>
        Map view is currently unavailable. Showing list view instead.
      </p>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!loading && shops.length === 0 && (
        <div className="text-center py-16">
          <Store className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-lg">No shops found nearby</p>
          <p className="text-gray-400 dark:text-gray-600 text-sm mt-1">Try adjusting your location</p>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-2xl mx-auto">
        {shops.map((shop) => {
          const dist =
            shop.distance_km ??
            (latitude && longitude && shop.latitude && shop.longitude
              ? haversineKm(latitude, longitude, shop.latitude, shop.longitude)
              : null)
          return (
            <button
              key={shop.id}
              onClick={() => navigate(`/app/shop/${shop.id}`)}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex items-start gap-4 text-left hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <Store className="h-6 w-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-base">{shop.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {shop.category || shop.address || shop.locality || ''}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {shop.rating != null && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {Number(shop.rating).toFixed(1)}
                    </span>
                  )}
                  {dist != null && (
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                      {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                    </span>
                  )}
                  {shop.is_open != null && (
                    <span className={`text-xs font-medium ${shop.is_open ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {shop.is_open ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors mt-1" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shop Card (floating panel)
// ---------------------------------------------------------------------------
function ShopCard({ shop, isSelected, onClick, onNavigate, userLat, userLng }) {
  const dist =
    shop.distance_km ??
    (userLat && userLng && shop.latitude && shop.longitude
      ? haversineKm(userLat, userLng, shop.latitude, shop.longitude)
      : null)

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-2xl p-3.5 transition-all duration-300 border group
        ${isSelected
          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 shadow-lg shadow-purple-500/10 scale-[1.02]'
          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Shop Logo */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300
          ${isSelected
            ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
            : 'bg-gradient-to-br from-purple-500/80 to-pink-500/80'
          }
        `}>
          {shop.logo_url ? (
            <img src={shop.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <Store className="h-5 w-5 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white truncate text-sm leading-tight">
            {shop.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {shop.category || shop.address || shop.locality || 'Local Shop'}
          </p>
          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            {shop.rating != null && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {Number(shop.rating).toFixed(1)}
              </span>
            )}
            {dist != null && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                <Navigation className="h-3 w-3" />
                {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
              </span>
            )}
            {shop.is_open != null && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${shop.is_open ? 'text-emerald-500' : 'text-red-400'}`}>
                <Clock className="h-3 w-3" />
                {shop.is_open ? 'Open' : 'Closed'}
              </span>
            )}
            {shop.delivers && (
              <span className="flex items-center gap-0.5 text-xs font-medium text-blue-500 dark:text-blue-400">
                <Truck className="h-3 w-3" />
                Delivers
              </span>
            )}
          </div>
        </div>

        {/* Visit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium mt-0.5 whitespace-nowrap"
        >
          Visit
        </button>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Map Popup Content (rendered as HTML string for Leaflet)
// ---------------------------------------------------------------------------
function shopPopupHtml(shop) {
  const rating = shop.rating != null ? `<span style="color:#d97706;font-weight:600;font-size:12px">★ ${Number(shop.rating).toFixed(1)}</span>` : ''
  const status = shop.is_open != null
    ? `<span style="font-size:11px;font-weight:600;color:${shop.is_open ? '#10b981' : '#ef4444'}">${shop.is_open ? 'Open' : 'Closed'}</span>`
    : ''
  return `
    <div style="padding:12px 14px;min-width:180px;font-family:system-ui,-apple-system,sans-serif">
      <div style="font-weight:700;font-size:14px;color:#111;margin-bottom:4px">${shop.name || 'Shop'}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${shop.category || shop.address || shop.locality || ''}</div>
      <div style="display:flex;gap:10px;align-items:center">
        ${rating}${status}
      </div>
    </div>
  `
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ShopsMapPage() {
  const navigate = useNavigate()
  const { latitude, longitude } = useLocationStore()

  // Core state
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShopId, setSelectedShopId] = useState(null)
  const [viewMode, setViewMode] = useState('map') // 'map' | 'list'
  const [searchQuery, setSearchQuery] = useState('')

  // Feature flag + leaflet availability
  const [mapEnabled, setMapEnabled] = useState(null) // null = checking
  const [leafletReady, setLeafletReady] = useState(false)
  const [leafletModules, setLeafletModules] = useState(null)

  // Bottom sheet (mobile)
  const [sheetExpanded, setSheetExpanded] = useState(false)

  // Refs
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})
  const userMarkerRef = useRef(null)
  const shopListRef = useRef(null)
  const sheetRef = useRef(null)

  // ---------- Feature flag check ----------
  useEffect(() => {
    let cancelled = false
    api.get('/features')
      .then(({ data }) => {
        if (!cancelled) setMapEnabled(data?.map_view === true)
      })
      .catch(() => {
        // If endpoint doesn't exist or fails, enable map by default
        if (!cancelled) setMapEnabled(true)
      })
    return () => { cancelled = true }
  }, [])

  // ---------- Dynamic Leaflet import ----------
  useEffect(() => {
    if (mapEnabled === false) return
    let cancelled = false

    async function loadLeaflet() {
      try {
        const [L, RL] = await Promise.all([
          import('leaflet'),
          import('react-leaflet'),
        ])
        if (!cancelled) {
          setLeafletModules({ L: L.default || L, RL })
          setLeafletReady(true)
        }
      } catch (err) {
        console.warn('Leaflet not available, falling back to list view:', err.message)
        if (!cancelled) {
          setLeafletReady(false)
          setMapEnabled(false)
        }
      }
    }
    loadLeaflet()
    return () => { cancelled = true }
  }, [mapEnabled])

  // ---------- Inject Leaflet CSS + custom styles ----------
  useEffect(() => {
    if (!leafletReady) return

    // Leaflet main CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // Custom marker / popup styles
    if (!document.getElementById('shops-map-css')) {
      const style = document.createElement('style')
      style.id = 'shops-map-css'
      style.textContent = USER_MARKER_CSS
      document.head.appendChild(style)
    }

    return () => {
      // cleanup not strictly necessary; styles are idempotent
    }
  }, [leafletReady])

  // ---------- Fetch shops ----------
  useEffect(() => {
    setLoading(true)
    getNearbyShops(latitude || 0, longitude || 0, { limit: 80 })
      .then(({ data }) => {
        const items = data?.items || data || []
        setShops(items)
      })
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [latitude, longitude])

  // ---------- Filtered shops ----------
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return shops
    const q = searchQuery.toLowerCase()
    return shops.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.locality?.toLowerCase().includes(q)
    )
  }, [shops, searchQuery])

  // ---------- Center map on a shop ----------
  const centerOnShop = useCallback((shop) => {
    setSelectedShopId(shop.id)
    if (mapInstanceRef.current && shop.latitude && shop.longitude) {
      mapInstanceRef.current.flyTo([shop.latitude, shop.longitude], 16, { duration: 0.8 })
    }
    // Scroll to card in panel
    const card = document.getElementById(`shop-card-${shop.id}`)
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    // On mobile, expand the bottom sheet so the card is visible
    setSheetExpanded(true)
  }, [])

  // ---------- Re-center on user location ----------
  const recenterUser = useCallback(() => {
    if (mapInstanceRef.current && latitude && longitude) {
      mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 0.8 })
    }
  }, [latitude, longitude])

  // ---------- Initialize map (imperative Leaflet) ----------
  const initMap = useCallback((container) => {
    if (!container || !leafletModules || mapInstanceRef.current) return
    const { L } = leafletModules

    const center = latitude && longitude ? [latitude, longitude] : [12.9716, 77.5946] // Default: Bangalore
    const map = L.map(container, {
      center,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    })

    // Tile layer (CartoDB Voyager -- beautiful, free, no key)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    // Attribution (required by CartoDB)
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>')
      .addTo(map)

    mapInstanceRef.current = map

    // User location marker
    if (latitude && longitude) {
      const userIcon = L.divIcon({
        className: '',
        html: '<div class="user-location-pulse"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<div style="padding:8px 12px;font-family:system-ui;font-weight:600;font-size:13px">You are here</div>')
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [leafletModules, latitude, longitude])

  // ---------- Sync shop markers ----------
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletModules) return
    const { L } = leafletModules
    const map = mapInstanceRef.current

    // Remove old markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m))
    markersRef.current = {}

    // Add new markers
    filteredShops.forEach((shop) => {
      if (!shop.latitude || !shop.longitude) return

      const isSelected = shop.id === selectedShopId
      const icon = L.divIcon({
        className: '',
        html: `<div class="shop-marker-icon ${isSelected ? 'selected' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -22],
      })

      const marker = L.marker([shop.latitude, shop.longitude], { icon })
        .addTo(map)
        .bindPopup(shopPopupHtml(shop), { closeButton: false, maxWidth: 260 })

      marker.on('click', () => {
        setSelectedShopId(shop.id)
        setSheetExpanded(true)
        const card = document.getElementById(`shop-card-${shop.id}`)
        card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })

      markersRef.current[shop.id] = marker
    })

    // Fit bounds if we have shops
    if (filteredShops.length > 0) {
      const validShops = filteredShops.filter((s) => s.latitude && s.longitude)
      if (validShops.length > 0) {
        const bounds = L.latLngBounds(validShops.map((s) => [s.latitude, s.longitude]))
        if (latitude && longitude) bounds.extend([latitude, longitude])
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
      }
    }
  }, [filteredShops, leafletModules, selectedShopId, latitude, longitude])

  // ---------- Update selected marker style ----------
  useEffect(() => {
    if (!leafletModules) return
    const { L } = leafletModules

    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const shop = shops.find((s) => s.id === id || String(s.id) === id)
      if (!shop) return
      const isSelected = String(id) === String(selectedShopId)
      const icon = L.divIcon({
        className: '',
        html: `<div class="shop-marker-icon ${isSelected ? 'selected' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -22],
      })
      marker.setIcon(icon)
    })
  }, [selectedShopId, leafletModules, shops])

  // ========================================================================
  // RENDER
  // ========================================================================

  // Still checking feature flag
  if (mapEnabled === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto" />
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-4">Loading map...</p>
        </div>
      </div>
    )
  }

  // Feature disabled or Leaflet unavailable -- show fallback list
  if (mapEnabled === false || (!leafletReady && !loading)) {
    return <FallbackListView shops={filteredShops} loading={loading} navigate={navigate} latitude={latitude} longitude={longitude} />
  }

  // User toggled to list mode
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-800/60">
          <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 border-0 focus:ring-2 focus:ring-purple-500/40 outline-none transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <button
              onClick={() => setViewMode('map')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
            >
              <MapIcon className="h-4 w-4" />
              Map
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-4 max-w-3xl mx-auto pb-24">
          {loading ? (
            <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
          ) : filteredShops.length === 0 ? (
            <div className="text-center py-16">
              <Store className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-400 dark:text-gray-500 text-lg">No shops found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 font-medium px-1">
                {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''} found
              </p>
              {filteredShops.map((shop) => (
                <div key={shop.id} id={`shop-card-list-${shop.id}`}>
                  <ShopCard
                    shop={shop}
                    isSelected={shop.id === selectedShopId}
                    onClick={() => { setSelectedShopId(shop.id); setViewMode('map'); centerOnShop(shop) }}
                    onNavigate={() => navigate(`/app/shop/${shop.id}`)}
                    userLat={latitude}
                    userLng={longitude}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ======== MAP VIEW ========
  return (
    <PageTransition>
      <div className="relative h-screen w-full overflow-hidden bg-gray-100 dark:bg-gray-950">

      {/* -------- Map Container -------- */}
      <div
        ref={(el) => { mapRef.current = el; initMap(el) }}
        className="absolute inset-0 z-0"
        style={{ height: '100%', width: '100%' }}
      />

      {/* -------- Loading Overlay -------- */}
      {(loading || !leafletReady) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-sm">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-3 font-medium">
              {!leafletReady ? 'Loading map...' : 'Finding shops...'}
            </p>
          </div>
        </div>
      )}

      {/* -------- Top Search Bar (overlaid on map) -------- */}
      <div className="absolute top-4 left-4 right-4 z-20 md:left-[380px] md:right-4 lg:left-[420px]">
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 border border-white/40 dark:border-gray-700/40 shadow-lg shadow-black/5 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400/40 outline-none transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {/* -------- Map Controls (right side) -------- */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-2">
        <button
          onClick={recenterUser}
          title="Center on my location"
          className="w-10 h-10 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/5 border border-white/40 dark:border-gray-700/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all"
        >
          <Locate className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Zoom in"
          className="w-10 h-10 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/5 border border-white/40 dark:border-gray-700/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all"
        >
          <ZoomIn className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Zoom out"
          className="w-10 h-10 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/5 border border-white/40 dark:border-gray-700/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all"
        >
          <ZoomOut className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* -------- View Mode Toggle (bottom right) -------- */}
      <div className="absolute right-4 bottom-6 z-20 md:bottom-6">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-lg shadow-black/10 border border-white/40 dark:border-gray-700/40 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
        >
          <List className="h-4 w-4" />
          List View
        </button>
      </div>

      {/* -------- Desktop: Floating Side Panel -------- */}
      <div className="hidden md:flex absolute top-4 left-4 bottom-4 z-10 w-[350px] lg:w-[390px] flex-col">
        <div className="flex flex-col h-full rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl border border-white/40 dark:border-gray-800/40 shadow-2xl shadow-black/5 overflow-hidden">

          {/* Panel Header */}
          <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100/80 dark:border-gray-800/60">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nearby Shops</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {latitude && longitude && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Shop List */}
          <div ref={shopListRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : filteredShops.length === 0 ? (
              <div className="text-center py-12">
                <Store className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-400 dark:text-gray-500 text-sm">No shops found</p>
              </div>
            ) : (
              filteredShops.map((shop) => (
                <div key={shop.id} id={`shop-card-${shop.id}`}>
                  <ShopCard
                    shop={shop}
                    isSelected={shop.id === selectedShopId}
                    onClick={() => centerOnShop(shop)}
                    onNavigate={() => navigate(`/app/shop/${shop.id}`)}
                    userLat={latitude}
                    userLng={longitude}
                  />
                </div>
              ))
            )}
          </div>

          {/* Panel Footer */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100/80 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-950/30">
            <button
              onClick={recenterUser}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-lg shadow-purple-500/20"
            >
              <Locate className="h-4 w-4" />
              Center on My Location
            </button>
          </div>
        </div>
      </div>

      {/* -------- Mobile: Bottom Sheet -------- */}
      <div
        ref={sheetRef}
        className={`
          md:hidden absolute left-0 right-0 bottom-0 z-10 transition-all duration-500 ease-out
          ${sheetExpanded ? 'top-[15vh]' : 'top-[calc(100vh-180px)]'}
        `}
      >
        <div className="h-full flex flex-col rounded-t-3xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-t border-gray-200/60 dark:border-gray-800/60 shadow-[0_-8px_40px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* Drag Handle */}
          <button
            onClick={() => setSheetExpanded((v) => !v)}
            className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-2" />
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {filteredShops.length} Nearby Shop{filteredShops.length !== 1 ? 's' : ''}
              </p>
              {sheetExpanded
                ? <ChevronDown className="h-4 w-4 text-gray-400" />
                : <ChevronUp className="h-4 w-4 text-gray-400" />
              }
            </div>
          </button>

          {/* Mobile Shop List */}
          <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-2.5">
            {loading ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
            ) : filteredShops.length === 0 ? (
              <div className="text-center py-8">
                <Store className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-400 text-sm">No shops found</p>
              </div>
            ) : (
              filteredShops.map((shop) => (
                <div key={shop.id} id={`shop-card-${shop.id}`}>
                  <ShopCard
                    shop={shop}
                    isSelected={shop.id === selectedShopId}
                    onClick={() => centerOnShop(shop)}
                    onNavigate={() => navigate(`/app/shop/${shop.id}`)}
                    userLat={latitude}
                    userLng={longitude}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  )
}
