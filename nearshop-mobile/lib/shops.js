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
