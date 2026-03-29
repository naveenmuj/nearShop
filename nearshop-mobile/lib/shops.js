import client, { authGet, authDelete, authPost, authPut } from './api';

// Public shop endpoints
export const getNearbyShops = (lat, lng, params = {}) =>
  client.get('/shops/nearby', { params: { lat, lng, ...params } });
export const searchShops = (q, params = {}) =>
  client.get('/shops/search', { params: { q, ...params } });
export const getShop = (id) => client.get(`/shops/${id}`);
export const getShopProducts = (id, params = {}) =>
  client.get(`/shops/${id}/products`, { params });
export const getShopReviews = (id) => client.get(`/reviews/shop/${id}`);

// Auth-required shop endpoints
export const followShop = (id) => authPost(`/shops/${id}/follow`);
export const unfollowShop = (id) => authDelete(`/shops/${id}/follow`);
export const createShop = (data) => authPost('/shops', data);
export const updateShop = (id, data) => authPut(`/shops/${id}`, data);
export const getMyShops = () => authGet('/shops/mine');

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP VERIFICATION APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const requestVerification = (shopId, data) =>
  authPost(`/shops/${shopId}/verification/request`, data);

export const getVerificationStatus = (shopId) =>
  authGet(`/shops/${shopId}/verification/status`);

// ═══════════════════════════════════════════════════════════════════════════════
// SHOP REPORTS & UTILS (auth required)
// ═══════════════════════════════════════════════════════════════════════════════

export const getEodReport = (shopId, date = null) =>
  authGet(`/shops/${shopId}/eod-report`, { params: date ? { date } : {} });

export const getDailySummary = (shopId) =>
  authGet(`/shops/${shopId}/daily-summary`);

export const getQrCode = (shopId) =>
  authGet(`/shops/${shopId}/qr-code`, { responseType: 'blob' });

export const getShareCard = (shopId) =>
  authGet(`/shops/${shopId}/share-card`);

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH & DELIVERY APIs
// ═══════════════════════════════════════════════════════════════════════════════

// Public search
export const searchUnified = (q, lat = null, lng = null) => {
  const params = { q };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/search/unified', { params });
};

// AI search - requires auth
export const runConversationalSearch = (query, lat = null, lng = null, radiusKm = 5) =>
  authPost('/ai/search/conversational/run', {
    query,
    latitude: lat,
    longitude: lng,
    radius_km: radiusKm,
  });

// Public suggestions
export const getSearchSuggestions = (q, lat = null, lng = null) => {
  const params = { q };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/search/suggestions', { params });
};

// Public delivery lookup
export const getNearbyDeliverableShops = (lat, lng, radiusKm = 5, limit = 10) =>
  client.get('/delivery/nearby-shops', {
    params: { lat, lng, radius_km: radiusKm, limit },
  });

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALIZATION APIs (auth required for user-specific data)
// ═══════════════════════════════════════════════════════════════════════════════

export const logSearch = (query) =>
  authPost('/search/log', null, { params: { q: query } });

export const getSearchHistory = (limit = 10) =>
  authGet('/search/history', { params: { limit } });

export const clearSearchHistory = () =>
  authDelete('/search/history');

export const getRecommendations = (lat = null, lng = null, limit = 10) => {
  const params = { limit };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return authGet('/recommendations/for-you', { params });
};
