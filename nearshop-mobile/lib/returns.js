/**
 * Returns API - Return requests and policies
 */
import { authGet, authPost, authPatch } from './api';
import { withRetry } from './retry';
import { recordLocalTelemetry } from './localTelemetry';

// Get return reasons
export async function getReturnReasons() {
  const response = await authGet('/returns/reasons');
  return response.data.reasons;
}

// Create return request
export async function createReturnRequest(orderId, itemName, itemPrice, reason, description = null, images = null, productId = null, itemQuantity = 1) {
  try {
    const response = await withRetry(() => authPost('/returns', {
      order_id: orderId,
      product_id: productId,
      item_name: itemName,
      item_quantity: itemQuantity,
      item_price: itemPrice,
      reason,
      description,
      images,
    }), { retries: 2, delayMs: 500 });
    recordLocalTelemetry({
      type: 'mutation',
      name: 'create_return_request',
      outcome: 'success',
    }).catch(() => {});
    return response.data;
  } catch (error) {
    recordLocalTelemetry({
      type: 'mutation',
      name: 'create_return_request',
      outcome: 'failure',
      status: error?.response?.status || null,
    }).catch(() => {});
    throw error;
  }
}

// Get my returns (customer)
export async function getMyReturns(status = null, limit = 20, offset = 0) {
  const params = new URLSearchParams({ limit, offset });
  if (status) params.append('status', status);
  const response = await authGet(`/returns/my?${params}`);
  return response.data;
}

// Get shop returns (business)
export async function getShopReturns(status = null, limit = 20, offset = 0) {
  const params = new URLSearchParams({ limit, offset });
  if (status) params.append('status', status);
  const response = await authGet(`/returns/shop?${params}`);
  return response.data;
}

// Get return detail
export async function getReturnDetail(returnId) {
  const response = await authGet(`/returns/${returnId}`);
  return response.data;
}

// Approve return (business)
export async function approveReturn(returnId, refundAmount = null, refundMethod = 'store_credit') {
  const params = new URLSearchParams({ refund_method: refundMethod });
  if (refundAmount) params.append('refund_amount', refundAmount);
  try {
    const response = await withRetry(() => authPost(`/returns/${returnId}/approve?${params}`), { retries: 2, delayMs: 500 });
    recordLocalTelemetry({ type: 'mutation', name: 'approve_return', outcome: 'success' }).catch(() => {});
    return response.data;
  } catch (error) {
    recordLocalTelemetry({
      type: 'mutation',
      name: 'approve_return',
      outcome: 'failure',
      status: error?.response?.status || null,
    }).catch(() => {});
    throw error;
  }
}

// Reject return (business)
export async function rejectReturn(returnId, reason) {
  try {
    const response = await withRetry(
      () => authPost(`/returns/${returnId}/reject?reason=${encodeURIComponent(reason)}`),
      { retries: 2, delayMs: 500 },
    );
    recordLocalTelemetry({ type: 'mutation', name: 'reject_return', outcome: 'success' }).catch(() => {});
    return response.data;
  } catch (error) {
    recordLocalTelemetry({
      type: 'mutation',
      name: 'reject_return',
      outcome: 'failure',
      status: error?.response?.status || null,
    }).catch(() => {});
    throw error;
  }
}

// Update return status (business)
export async function updateReturnStatus(returnId, payload) {
  try {
    const response = await withRetry(() => authPatch(`/returns/${returnId}`, payload), { retries: 2, delayMs: 500 });
    recordLocalTelemetry({ type: 'mutation', name: 'update_return_status', outcome: 'success' }).catch(() => {});
    return response.data;
  } catch (error) {
    recordLocalTelemetry({
      type: 'mutation',
      name: 'update_return_status',
      outcome: 'failure',
      status: error?.response?.status || null,
    }).catch(() => {});
    throw error;
  }
}

export async function markReturnProcessing(returnId, resolutionNotes = 'Return moved to processing') {
  return updateReturnStatus(returnId, {
    status: 'processing',
    resolution_notes: resolutionNotes,
  });
}

export async function markReturnCompleted(returnId, resolutionNotes = 'Return completed') {
  return updateReturnStatus(returnId, {
    status: 'completed',
    resolution_notes: resolutionNotes,
  });
}

// Get shop return policy
export async function getShopPolicy(shopId) {
  const response = await authGet(`/returns/shop/${shopId}/policy`);
  return response.data;
}

// Get my shop policy (business)
export async function getMyPolicy() {
  const response = await authGet('/returns/policy/mine');
  return response.data;
}

// Update my policy (business)
export async function updateMyPolicy(policyData) {
  const response = await authPatch('/returns/policy/mine', policyData);
  return response.data;
}
