import client, { authGet, authPost, authPut } from './api';
import { withRetry } from './retry';
import { recordLocalTelemetry } from './localTelemetry';

export const createOrder = async (data) => {
  try {
    const response = await authPost('/orders', data);
    recordLocalTelemetry({
      type: 'mutation',
      name: 'create_order',
      outcome: 'success',
    }).catch(() => {});
    return response;
  } catch (error) {
    recordLocalTelemetry({
      type: 'mutation',
      name: 'create_order',
      outcome: 'failure',
      status: error?.response?.status || null,
    }).catch(() => {});
    throw error;
  }
};
export const getMyOrders = (params = {}) =>
  authGet('/orders/my', { params });
export const getOrderById = (orderId) => authGet(`/orders/${orderId}`);
export const getShopOrders = (shopId, params = {}) =>
  authGet(`/orders/shop/${shopId}`, { params });
export const updateOrderStatus = (id, status) =>
  withRetry(() => authPut(`/orders/${id}/status`, { status }), { retries: 2, delayMs: 500 });
export const cancelOrder = (id, reason = '') =>
  withRetry(() => authPost(`/orders/${id}/cancel`, { reason }), { retries: 2, delayMs: 500 });

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createPaymentOrder = (orderId) =>
  withRetry(
    () => authPost('/orders/payments/create-order', { order_id: orderId }),
    {
      retries: 2,
      delayMs: 500,
      onSuccess: () => recordLocalTelemetry({
        type: 'mutation',
        name: 'create_payment_order',
        outcome: 'success',
      }).catch(() => {}),
      onFailure: ({ error }) => recordLocalTelemetry({
        type: 'mutation',
        name: 'create_payment_order',
        outcome: 'failure',
        status: error?.response?.status || null,
      }).catch(() => {}),
    },
  );

export const confirmPayment = (data) =>
  withRetry(
    () => authPost('/orders/payments/confirm', data),
    {
      retries: 2,
      delayMs: 500,
      onSuccess: () => recordLocalTelemetry({
        type: 'mutation',
        name: 'confirm_payment',
        outcome: 'success',
      }).catch(() => {}),
      onFailure: ({ error }) => recordLocalTelemetry({
        type: 'mutation',
        name: 'confirm_payment',
        outcome: 'failure',
        status: error?.response?.status || null,
      }).catch(() => {}),
    },
  );

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
