/**
 * Returns API - Return requests and policies
 */
import { authGet, authPost, authPatch } from './api';

// Get return reasons
export async function getReturnReasons() {
  const response = await authGet('/returns/reasons');
  return response.data.reasons;
}

// Create return request
export async function createReturnRequest(orderId, itemName, itemPrice, reason, description = null, images = null, productId = null, itemQuantity = 1) {
  const response = await authPost('/returns', {
    order_id: orderId,
    product_id: productId,
    item_name: itemName,
    item_quantity: itemQuantity,
    item_price: itemPrice,
    reason,
    description,
    images,
  });
  return response.data;
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
  const response = await authPost(`/returns/${returnId}/approve?${params}`);
  return response.data;
}

// Reject return (business)
export async function rejectReturn(returnId, reason) {
  const response = await authPost(`/returns/${returnId}/reject?reason=${encodeURIComponent(reason)}`);
  return response.data;
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
