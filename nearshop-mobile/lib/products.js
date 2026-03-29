import client, { authPost, authPut, authDelete } from './api';

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
// FIXED: createProduct requires auth
export const createProduct = (shopId, data) =>
  authPost(`/products?shop_id=${shopId}`, data);
// FIXED: updateProduct requires auth
export const updateProduct = (id, data) => authPut(`/products/${id}`, data);
// FIXED: toggleAvailability requires auth
export const toggleAvailability = (id) => authPut(`/products/${id}/availability`);
// FIXED: deleteProduct requires auth
export const deleteProduct = (id) => authDelete(`/products/${id}`);
