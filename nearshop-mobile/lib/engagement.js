import client, { authGet, authPost, authDelete, authPatch } from './api'

// User engagement - requires auth
export const trackView = (productId) => authPost('/users/recently-viewed', { product_id: productId })
export const getRecentlyViewed = (limit = 20) => authGet('/users/recently-viewed', { params: { limit } })
export const clearRecentlyViewed = () => authDelete('/users/recently-viewed')

// Search - public
export const getSearchSuggestions = (q, limit = 5) => client.get('/search/suggestions', { params: { q, limit } })
export const logSearch = (query) => authPost('/search/log', { query })
export const getRecentSearches = () => authGet('/search/recent')
export const deleteRecentSearch = (query) => authDelete(`/search/recent/${encodeURIComponent(query)}`)

// Order tracking - requires auth
export const getOrderTracking = (orderId) => authGet(`/orders/${orderId}/tracking`)

// User features - requires auth
export const getUserAchievements = () => authGet('/users/achievements')
export const getDailySpinStatus = () => authGet('/daily-spin/status')
export const performDailySpin = () => authPost('/daily-spin')
export const updateUserSettings = (settings) => authPatch('/auth/settings', settings)
