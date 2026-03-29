import { authGet, authPost } from './api';

export const getShopStats = (shopId, period = '7d') =>
  authGet(`/analytics/shop/${shopId}/stats`, { params: { period } });

export const getProductAnalytics = (shopId) =>
  authGet(`/analytics/shop/${shopId}/products`);

export const getDemandInsights = (shopId, lat, lng) =>
  authGet(`/analytics/shop/${shopId}/demand`, { params: { lat, lng } });

export const getOperationalInsights = (shopId, lat, lng) =>
  authGet(`/analytics/shop/${shopId}/operational-insights`, { params: { lat, lng } });

export const trackEvent = (data) =>
  authPost('/analytics/events', data);

export const trackEventsBatch = (events) =>
  authPost('/analytics/events/batch', { events });
