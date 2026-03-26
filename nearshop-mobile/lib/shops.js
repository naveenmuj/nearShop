import client from './api';

export const getNearbyShops = (lat, lng, params = {}) =>
  client.get('/shops/nearby', { params: { lat, lng, ...params } });
export const searchShops = (q, params = {}) =>
  client.get('/shops/search', { params: { q, ...params } });
export const getShop = (id) => client.get(`/shops/${id}`);
export const getShopProducts = (id, params = {}) =>
  client.get(`/shops/${id}/products`, { params });
export const getShopReviews = (id) => client.get(`/reviews/shop/${id}`);
export const followShop = (id) => client.post(`/shops/${id}/follow`);
export const unfollowShop = (id) => client.delete(`/shops/${id}/follow`);
export const createShop = (data) => client.post('/shops', data);
export const updateShop = (id, data) => client.put(`/shops/${id}`, data);
export const getMyShops = () => client.get('/shops/mine');

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP VERIFICATION APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const requestVerification = (shopId, data) =>
  client.post(`/shops/${shopId}/verification/request`, data);

export const getVerificationStatus = (shopId) =>
  client.get(`/shops/${shopId}/verification/status`);

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP REPORTS & UTILS
// ═══════════════════════════════════════════════════════════════════════════════

export const getEodReport = (shopId, date = null) =>
  client.get(`/shops/${shopId}/eod-report`, { params: date ? { date } : {} });

export const getDailySummary = (shopId) =>
  client.get(`/shops/${shopId}/daily-summary`);

export const getQrCode = (shopId) =>
  client.get(`/shops/${shopId}/qr-code`, { responseType: 'blob' });

export const getShareCard = (shopId) =>
  client.get(`/shops/${shopId}/share-card`);

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH & DELIVERY APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const searchUnified = (q, lat = null, lng = null) => {
  const params = { q };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/search/unified', { params });
};

export const getSearchSuggestions = (q, lat = null, lng = null) => {
  const params = { q };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/search/suggestions', { params });
};

export const getNearbyDeliverableShops = (lat, lng, radiusKm = 5, limit = 10) =>
  client.get('/delivery/nearby-shops', {
    params: { lat, lng, radius_km: radiusKm, limit },
  });

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALIZATION APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const logSearch = (query) =>
  client.post('/search/log', null, { params: { q: query } });

export const getSearchHistory = (limit = 10) =>
  client.get('/search/history', { params: { limit } });

export const clearSearchHistory = () =>
  client.delete('/search/history');

export const getRecommendations = (lat = null, lng = null, limit = 10) => {
  const params = { limit };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/recommendations/for-you', { params });
};
