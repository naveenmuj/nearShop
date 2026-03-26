import client from './client'

/**
 * Search shops by query
 */
export const searchShops = (q, params = {}) =>
  client.get('/shops/search', { params: { q, ...params } })

/**
 * Unified search across products and shops
 */
export const searchUnified = (q, lat = null, lng = null, params = {}) => {
  const queryParams = { q, ...params }
  if (lat != null) queryParams.lat = lat
  if (lng != null) queryParams.lng = lng
  return client.get('/search/unified', { params: queryParams })
}

/**
 * Get smart search suggestions
 */
export const getSearchSuggestionsUnified = (q, lat = null, lng = null) => {
  const params = { q }
  if (lat != null) params.lat = lat
  if (lng != null) params.lng = lng
  return client.get('/search/suggestions', { params })
}

/**
 * Check if shop delivers to location
 */
export const checkDelivery = (shopId, lat, lng) => {
  return client.post(`/delivery/check/${shopId}`, {
    customer_lat: lat,
    customer_lng: lng,
  })
}

/**
 * Get pickup info for shop
 */
export const getPickupInfo = (shopId) => {
  return client.post(`/delivery/pickup/${shopId}`)
}

/**
 * Get nearby shops that deliver to customer
 */
export const getNearbyDeliverableShops = (lat, lng, radius_km = 5, limit = 10) => {
  return client.get('/delivery/nearby-shops', {
    params: { lat, lng, radius_km, limit },
  })
}

/**
 * Validate entire cart for delivery
 */
export const validateCart = (items, lat, lng) => {
  return client.post('/cart/validate', {
    customer_lat: lat,
    customer_lng: lng,
    items,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH PERSONALIZATION APIs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log search query for personalization
 */
export const logSearch = (query) => 
  client.post('/search/log', null, { params: { q: query } })

/**
 * Get user's search history
 */
export const getSearchHistory = (limit = 10) => 
  client.get('/search/history', { params: { limit } })

/**
 * Clear user's search history
 */
export const clearSearchHistory = () => 
  client.delete('/search/history')

/**
 * Get personalized recommendations (For You)
 */
export const getRecommendations = (lat = null, lng = null, limit = 10) => {
  const params = { limit }
  if (lat != null) params.lat = lat
  if (lng != null) params.lng = lng
  return client.get('/recommendations/for-you', { params })
}
