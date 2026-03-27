import client, { authGet, authPost, authPut } from './api';

export const createOrder = (data) => authPost('/orders', data);
export const getMyOrders = (params = {}) =>
  authGet('/orders/my', { params });
export const getOrderById = (orderId) => authGet(`/orders/${orderId}`);
export const getShopOrders = (shopId, params = {}) =>
  authGet(`/orders/shop/${shopId}`, { params });
export const updateOrderStatus = (id, status) =>
  authPut(`/orders/${id}/status`, { status });
export const cancelOrder = (id, reason = '') =>
  authPost(`/orders/${id}/cancel`, { reason });

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createPaymentOrder = (orderId) =>
  authPost('/orders/payments/create-order', { order_id: orderId });

export const confirmPayment = (data) =>
  authPost('/orders/payments/confirm', data);

export const getPaymentStatus = (orderId) =>
  authGet(`/orders/payments/status/${orderId}`);

export const processRefund = (orderId, amount = null, reason = 'customer_request') =>
  authPost('/orders/payments/refund', { order_id: orderId, amount, reason });

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE & EXPORT APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const downloadInvoice = (orderId) =>
  authGet(`/orders/${orderId}/invoice`, { responseType: 'blob' });

export const exportOrders = (shopId, options = {}) =>
  authPost(`/orders/shop/${shopId}/export`, {
    start_date: options.startDate,
    end_date: options.endDate,
    status: options.status,
    format: options.format || 'csv',
  }, { responseType: 'blob' });

// ═══════════════════════════════════════════════════════════════════════════════
// REAL-TIME ORDER TRACKING (WebSocket)
// ═══════════════════════════════════════════════════════════════════════════════

export const connectOrderTracking = (orderId, token, callbacks = {}) => {
  const { onMessage, onError, onClose, onOpen } = callbacks;
  const baseURL = client.defaults.baseURL.replace('http', 'ws');
  const wsUrl = `${baseURL}/orders/ws/track/${orderId}?token=${token}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Order tracking connected');
    onOpen?.();
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage?.(data);
  };
  ws.onerror = (error) => onError?.(error);
  ws.onclose = () => onClose?.();

  return {
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    ping: () => ws.send('ping'),
    close: () => ws.close(),
  };
};

export const connectShopOrders = (shopId, token, callbacks = {}) => {
  const { onMessage, onError, onClose, onOpen } = callbacks;
  const baseURL = client.defaults.baseURL.replace('http', 'ws');
  const wsUrl = `${baseURL}/orders/ws/shop/${shopId}?token=${token}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Shop orders connected');
    onOpen?.();
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage?.(data);
  };
  ws.onerror = (error) => onError?.(error);
  ws.onclose = () => onClose?.();

  return {
    send: (data) => ws.send(typeof data === 'string' ? data : JSON.stringify(data)),
    ping: () => ws.send('ping'),
    close: () => ws.close(),
  };
};
