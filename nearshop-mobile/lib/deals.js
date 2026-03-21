import client from './api';

export const getNearbyDeals = (lat, lng, params = {}) =>
  client.get('/deals/nearby', { params: { lat, lng, ...params } });
export const claimDeal = (id) => client.post(`/deals/${id}/claim`);
export const createDeal = (data, shopId) =>
  client.post(`/deals?shop_id=${shopId}`, data);
export const getShopDeals = (shopId) => client.get(`/deals/shop/${shopId}`);
export const deleteDeal = (id) => client.delete(`/deals/${id}`);
