import client from './api';

export const searchProducts = (params = {}) =>
  client.get('/products/search', { params });
export const getSearchSuggestions = (q, lat, lng) => {
  const params = { q };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return client.get('/search/suggestions', { params });
};
export const getProduct = (id) => client.get(`/products/${id}`);
export const getSimilarProducts = (id) => client.get(`/products/${id}/similar`);
export const createProduct = (shopId, data) =>
  client.post(`/products?shop_id=${shopId}`, data);
export const updateProduct = (id, data) => client.put(`/products/${id}`, data);
export const toggleAvailability = (id) => client.put(`/products/${id}/availability`);
export const deleteProduct = (id) => client.delete(`/products/${id}`);
