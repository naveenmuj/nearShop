import api from './client'
export const create = (data) => api.post('/orders', data)
export const getMy = (params = {}) => api.get('/orders/my', { params })
export const getById = (orderId) => api.get(`/orders/${orderId}`)
export const getShopOrders = (shopId, params = {}) => api.get(`/orders/shop/${shopId}`, { params })
export const updateStatus = (orderId, status) => api.put(`/orders/${orderId}/status`, { status })
export const cancel = (orderId, reason) => api.post(`/orders/${orderId}/cancel`, { reason })

// Named exports matching task spec
export const createOrder = (data) => api.post('/orders', data)
export const getMyOrders = (params = {}) => api.get('/orders/my', { params })
export const getOrderDetail = (id) => api.get(`/orders/${id}`)
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status })
export const cancelOrder = (id, reason = '') => api.post(`/orders/${id}/cancel`, { reason })
