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

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createPaymentOrder = (orderId) => 
  api.post('/orders/payments/create-order', { order_id: orderId })

export const confirmPayment = (data) => 
  api.post('/orders/payments/confirm', data)

export const getPaymentStatus = (orderId) => 
  api.get(`/orders/payments/status/${orderId}`)

export const processRefund = (orderId, amount = null, reason = 'customer_request') => 
  api.post('/orders/payments/refund', { order_id: orderId, amount, reason })

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE & EXPORT APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const downloadInvoice = (orderId) => 
  api.get(`/orders/${orderId}/invoice`, { responseType: 'blob' })

export const exportOrders = (shopId, options = {}) => 
  api.post(`/orders/shop/${shopId}/export`, {
    start_date: options.startDate,
    end_date: options.endDate,
    status: options.status,
    format: options.format || 'csv',
  }, { responseType: 'blob' })

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME ORDER TRACKING (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════════

export const connectOrderTracking = (orderId, token, onMessage, onError, onClose) => {
  const wsUrl = `${api.defaults.baseURL.replace('http', 'ws')}/orders/ws/track/${orderId}?token=${token}`
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => console.log('Order tracking connected')
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    onMessage?.(data)
  }
  ws.onerror = (error) => onError?.(error)
  ws.onclose = () => onClose?.()
  
  // Return cleanup function
  return {
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    ping: () => ws.send('ping'),
    close: () => ws.close(),
  }
}

export const connectShopOrders = (shopId, token, onMessage, onError, onClose) => {
  const wsUrl = `${api.defaults.baseURL.replace('http', 'ws')}/orders/ws/shop/${shopId}?token=${token}`
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => console.log('Shop orders connected')
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    onMessage?.(data)
  }
  ws.onerror = (error) => onError?.(error)
  ws.onclose = () => onClose?.()
  
  return {
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    ping: () => ws.send('ping'),
    close: () => ws.close(),
  }
}
