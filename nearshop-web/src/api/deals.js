import client from './client'

export const getNearbyDeals = (lat, lng, params = {}) =>
  client.get('/deals/nearby', { params: { lat, lng, ...params } })

export const claimDeal = (id) => client.post(`/deals/${id}/claim`)

// Legacy aliases kept for backwards compatibility
export const getNearby = getNearbyDeals
export const getById = (dealId) => client.get(`/deals/${dealId}`)
export const create = (data) => client.post('/deals', data)
export const update = (dealId, data) => client.put(`/deals/${dealId}`, data)
export const remove = (dealId) => client.delete(`/deals/${dealId}`)
export const claim = claimDeal

// ═══════════════════════════════════════════════════════════════════════════════
// COUPON APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createCoupon = (data, shopId = null) => 
  client.post('/deals/coupons', data, { params: shopId ? { shop_id: shopId } : {} })

export const listCoupons = (shopId = null) => 
  client.get('/deals/coupons', { params: shopId ? { shop_id: shopId } : {} })

export const validateCoupon = (code, shopId = null, orderAmount) => 
  client.post('/deals/coupons/validate', { code, shop_id: shopId, order_amount: orderAmount })

export const useCoupon = (couponId, orderId = null, discountApplied) => 
  client.post(`/deals/coupons/${couponId}/use`, null, { 
    params: { order_id: orderId, discount_applied: discountApplied } 
  })

export const deleteCoupon = (couponId) => client.delete(`/deals/coupons/${couponId}`)
