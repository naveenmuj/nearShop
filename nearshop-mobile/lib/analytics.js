import client from './api';

export const getShopStats = (shopId, period = '7d') =>
  client.get(`/analytics/shop/${shopId}/stats`, { params: { period } });

export const getProductAnalytics = (shopId) =>
  client.get(`/analytics/shop/${shopId}/products`);

export const getDemandInsights = (shopId, lat, lng) =>
  client.get(`/analytics/shop/${shopId}/demand`, { params: { lat, lng } });

export const getPhase1Insights = (shopId, lat, lng) =>
  client.get(`/analytics/shop/${shopId}/phase1`, { params: { lat, lng } });

export const trackEvent = (data) =>
  client.post('/analytics/events', data);
