import client from './client'

export const getNearbyShops = (lat, lng, params = {}) =>
  client.get('/shops/nearby', { params: { lat, lng, ...params } })

export const searchShops = (q, params = {}) =>
  client.get('/shops/search', { params: { q, ...params } })

export const getMyShops = () => client.get('/shops/mine')
export const getShop = (id) => client.get(`/shops/${id}`)
export const getShopProducts = (id, params = {}) => client.get(`/shops/${id}/products`, { params })
export const followShop = (id) => client.post(`/shops/${id}/follow`)
export const unfollowShop = (id) => client.delete(`/shops/${id}/follow`)
export const updateShop = (id, data) => client.put(`/shops/${id}`, data)

// Legacy aliases kept for backwards compatibility
export const getNearby = getNearbyShops
export const search = searchShops
export const getById = getShop
export const create = (data) => client.post('/shops', data)
export const update = (shopId, data) => client.put(`/shops/${shopId}`, data)
export const follow = followShop
export const unfollow = unfollowShop

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP VERIFICATION APIs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Submit verification document for shop
 * @param {string} shopId - Shop ID
 * @param {Object} data - { document_type, document_number, document_image_url, additional_info }
 */
export const requestVerification = (shopId, data) =>
  client.post(`/shops/${shopId}/verification/request`, data)

/**
 * Get shop verification status
 */
export const getVerificationStatus = (shopId) =>
  client.get(`/shops/${shopId}/verification/status`)

/**
 * Approve shop verification (Admin only)
 */
export const approveVerification = (shopId) =>
  client.post(`/shops/${shopId}/verification/approve`)

/**
 * Reject shop verification (Admin only)
 * @param {string} shopId - Shop ID
 * @param {string} reason - Reason for rejection
 */
export const rejectVerification = (shopId, reason) =>
  client.post(`/shops/${shopId}/verification/reject`, null, { params: { reason } })

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP REPORTS & EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get end-of-day report
 */
export const getEodReport = (shopId, date = null) =>
  client.get(`/shops/${shopId}/eod-report`, { params: date ? { date } : {} })

/**
 * Get daily summary
 */
export const getDailySummary = (shopId) =>
  client.get(`/shops/${shopId}/daily-summary`)

/**
 * Get shop QR code
 */
export const getQrCode = (shopId) =>
  client.get(`/shops/${shopId}/qr-code`, { responseType: 'blob' })

/**
 * Get shop share card
 */
export const getShareCard = (shopId) =>
  client.get(`/shops/${shopId}/share-card`)
