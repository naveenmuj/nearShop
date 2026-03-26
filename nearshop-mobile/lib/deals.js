import client from './api';

export const getNearbyDeals = (lat, lng, params = {}) =>
  client.get('/deals/nearby', { params: { lat, lng, ...params } });
export const claimDeal = (id) => client.post(`/deals/${id}/claim`);
export const createDeal = (data, shopId) =>
  client.post(`/deals?shop_id=${shopId}`, data);
export const getShopDeals = (shopId) => client.get(`/deals/shop/${shopId}`);
export const deleteDeal = (id) => client.delete(`/deals/${id}`);

// ═══════════════════════════════════════════════════════════════════════════════
// COUPON APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createCoupon = (data, shopId = null) =>
  client.post('/deals/coupons', data, { params: shopId ? { shop_id: shopId } : {} });

export const listCoupons = (shopId = null) =>
  client.get('/deals/coupons', { params: shopId ? { shop_id: shopId } : {} });

export const validateCoupon = (code, shopId = null, orderAmount) =>
  client.post('/deals/coupons/validate', { code, shop_id: shopId, order_amount: orderAmount });

export const useCoupon = (couponId, orderId = null, discountApplied) =>
  client.post(`/deals/coupons/${couponId}/use`, null, {
    params: { order_id: orderId, discount_applied: discountApplied }
  });

export const deleteCoupon = (couponId) => client.delete(`/deals/coupons/${couponId}`);
