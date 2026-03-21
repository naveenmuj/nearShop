import client from './client'

export const getNearbyDeals = (lat, lng, params = {}) =>
  client.get('/deals/nearby', { params: { lat, lng, ...params } })

export const claimDeal = (id) => client.post(`/deals/${id}/claim`)

// Legacy aliases kept for backwards compatibility
export const getNearby = getNearbyDeals
export const getById = (dealId) => client.get(`/deals/${dealId}`)
export const create = (data) => client.post('/deals', data)
export const update = (dealId, data) => client.put(`/deals/${dealId}`, data)
export const remove = (dealId) => client.delete(`/deals/${dealId}`)
export const claim = claimDeal
