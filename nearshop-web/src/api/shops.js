import client from './client'

export const getNearbyShops = (lat, lng, params = {}) =>
  client.get('/shops/nearby', { params: { lat, lng, ...params } })

export const searchShops = (q, params = {}) =>
  client.get('/shops/search', { params: { q, ...params } })

export const getMyShops = () => client.get('/shops/mine')
export const getShop = (id) => client.get(`/shops/${id}`)
export const getShopProducts = (id, params = {}) => client.get(`/shops/${id}/products`, { params })
export const followShop = (id) => client.post(`/shops/${id}/follow`)
export const unfollowShop = (id) => client.delete(`/shops/${id}/follow`)
export const updateShop = (id, data) => client.put(`/shops/${id}`, data)

// Legacy aliases kept for backwards compatibility
export const getNearby = getNearbyShops
export const search = searchShops
export const getById = getShop
export const create = (data) => client.post('/shops', data)
export const update = (shopId, data) => client.put(`/shops/${shopId}`, data)
export const follow = followShop
export const unfollow = unfollowShop
