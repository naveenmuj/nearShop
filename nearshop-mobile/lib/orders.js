import client from './api';

export const createOrder = (data) => client.post('/orders', data);
export const getMyOrders = (params = {}) =>
  client.get('/orders/my', { params });
export const getShopOrders = (shopId, params = {}) =>
  client.get(`/orders/shop/${shopId}`, { params });
export const updateOrderStatus = (id, status) =>
  client.put(`/orders/${id}/status`, { status });
export const cancelOrder = (id, reason = '') =>
  client.post(`/orders/${id}/cancel`, { reason });
