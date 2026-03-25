import client from './client'

/**
 * Delivery-related API calls
 */

export const checkDeliveryEligibility = (shopId, customerLat, customerLng) => {
  return client.post(`/delivery/check/${shopId}`, {
    customer_lat: customerLat,
    customer_lng: customerLng,
  })
}

export const getPickupInfo = (shopId) => {
  return client.post(`/delivery/pickup/${shopId}`)
}

export const getShopsWithDelivery = (lat, lng, radius_km = 5, limit = 10) => {
  return client.get('/delivery/nearby-shops', {
    params: { lat, lng, radius_km, limit },
  })
}

export const validateCartDelivery = (cartItems, lat, lng) => {
  return client.post('/cart/validate', {
    customer_lat: lat,
    customer_lng: lng,
    items: cartItems,
  })
}
