import client from './client'

export const getShopReviews = (shopId, params = {}) =>
  client.get(`/reviews/shop/${shopId}`, { params })

export const createReview = (shopId, data) =>
  client.post('/reviews', { shop_id: shopId, ...data })
