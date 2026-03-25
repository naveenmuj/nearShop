import client from '../api';

/**
 * Mobile API functions for delivery and search
 */

export const searchUnified = async (query: string, lat: number, lng: number) => {
  const response = await client.get('/search/unified', {
    params: { q: query, lat, lng },
  });
  return response.data;
};

export const getSearchSuggestions = async (query: string, lat: number, lng: number) => {
  const response = await client.get('/search/suggestions', {
    params: { q: query, lat, lng },
  });
  return response.data;
};

export const checkDeliveryEligibility = async (shopId: string, lat: number, lng: number) => {
  const response = await client.post(`/delivery/check/${shopId}`, {
    customer_lat: lat,
    customer_lng: lng,
  });
  return response.data;
};

export const getShopsWithDelivery = async (lat: number, lng: number, radiusKm = 5) => {
  const response = await client.get('/delivery/nearby-shops', {
    params: { lat, lng, radius_km: radiusKm, limit: 10 },
  });
  return response.data;
};

export const validateCart = async (items: any[], lat: number, lng: number) => {
  const response = await client.post('/cart/validate', {
    customer_lat: lat,
    customer_lng: lng,
    items,
  });
  return response.data;
};
