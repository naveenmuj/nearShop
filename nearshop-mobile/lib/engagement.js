import client, { authPatch } from './api'

export const trackView = (productId) => client.post('/users/recently-viewed', { product_id: productId })
export const getRecentlyViewed = (limit = 20) => client.get('/users/recently-viewed', { params: { limit } })
export const clearRecentlyViewed = () => client.delete('/users/recently-viewed')
export const getSearchSuggestions = (q, limit = 5) => client.get('/search/suggestions', { params: { q, limit } })
export const logSearch = (query) => client.post('/search/log', { query })
export const getRecentSearches = () => client.get('/search/recent')
export const deleteRecentSearch = (query) => client.delete(`/search/recent/${encodeURIComponent(query)}`)
export const getOrderTracking = (orderId) => client.get(`/orders/${orderId}/tracking`)
export const getUserAchievements = () => client.get('/users/achievements')
export const getDailySpinStatus = () => client.get('/daily-spin/status')
export const performDailySpin = () => client.post('/daily-spin')
export const updateUserSettings = (settings) => authPatch('/auth/settings', settings)
