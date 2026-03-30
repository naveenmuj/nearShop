/**
 * Subscriptions API
 */
import { authGet, authPost } from './api';

// Get all subscription tiers
export async function getSubscriptionTiers() {
  const response = await authGet('/subscriptions/tiers');
  return response.data;
}

// Get my subscription
export async function getMySubscription() {
  const response = await authGet('/subscriptions/mine');
  return response.data;
}

// Upgrade subscription
export async function upgradeSubscription(newTier, billingCycle = 'monthly') {
  const response = await authPost('/subscriptions/upgrade', {
    new_tier: newTier,
    billing_cycle: billingCycle,
  });
  return response.data;
}

// Cancel subscription
export async function cancelSubscription() {
  const response = await authPost('/subscriptions/cancel');
  return response.data;
}

// Get invoices
export async function getSubscriptionInvoices(limit = 20) {
  const response = await authGet(`/subscriptions/invoices?limit=${limit}`);
  return response.data;
}

// Get usage
export async function getSubscriptionUsage() {
  const response = await authGet('/subscriptions/usage');
  return response.data;
}

// Check feature limit
export async function checkFeatureLimit(feature) {
  const response = await authGet(`/subscriptions/check/${feature}`);
  return response.data;
}
