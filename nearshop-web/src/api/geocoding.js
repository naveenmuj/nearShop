/**
 * Geocoding via OpenStreetMap Nominatim (free, no API key needed).
 * Reverse geocode: lat/lng → address
 * Forward search: query string → [{lat, lng, display_name}]
 */

export async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) return null
  const data = await res.json()
  // Build a short readable name: neighbourhood + city
  const a = data.address || {}
  const parts = [
    a.neighbourhood || a.suburb || a.hamlet,
    a.city || a.town || a.village || a.county,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : data.display_name?.split(',').slice(0, 2).join(',').trim()
}

export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=in`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) return []
  const data = await res.json()
  return data.map(item => {
    const a = item.address || {}
    const short = [
      a.neighbourhood || a.suburb || a.hamlet,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean).slice(0, 3).join(', ')
    return {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: short || item.display_name?.split(',').slice(0, 2).join(',').trim(),
      fullName: item.display_name,
    }
  })
}
