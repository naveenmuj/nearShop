import client, { authDelete, authGet, authPost } from './api';

export const getNearbyDeals = (lat, lng, params = {}) =>
  client.get('/deals/nearby', { params: { lat, lng, ...params } });
export const claimDeal = (id) => authPost(`/deals/${id}/claim`);
export const createDeal = (data, shopId) =>
  authPost(`/deals?shop_id=${shopId}`, data);
export const getShopDeals = (shopId) => authGet(`/deals/shop/${shopId}`);
export const deleteDeal = (id) => authDelete(`/deals/${id}`);

// ═══════════════════════════════════════════════════════════════════════════════
// COUPON APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createCoupon = (data, shopId = null) =>
  authPost('/deals/coupons', data, { params: shopId ? { shop_id: shopId } : {} });

export const listCoupons = (shopId = null) =>
  authGet('/deals/coupons', { params: shopId ? { shop_id: shopId } : {} });

export const validateCoupon = (code, shopId = null, orderAmount) =>
  authPost('/deals/coupons/validate', { code, shop_id: shopId, order_amount: orderAmount });

export const useCoupon = (couponId, orderId = null, discountApplied) =>
  authPost(`/deals/coupons/${couponId}/use`, null, {
    params: { order_id: orderId, discount_applied: discountApplied }
  });

export const deleteCoupon = (couponId) => authDelete(`/deals/coupons/${couponId}`);
