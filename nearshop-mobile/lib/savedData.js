/**
 * API Layer - Addresses and Payment Methods
 * Handles all HTTP requests to backend endpoints
 * Integrates with Razorpay for card tokenization
 */

import client, { authGet, authPost, authPut, authDelete } from './api';

// ──────────────────────────────────────────────────────────────────────────────
// ADDRESSES API
// ──────────────────────────────────────────────────────────────────────────────

export const listAddresses = async (skip = 0, limit = 50) => {
  return authGet(`/api/v1/addresses?skip=${skip}&limit=${limit}`);
};

export const getAddress = (id) => authGet(`/api/v1/addresses/${id}`);

export const createAddress = (data) => authPost('/api/v1/addresses', data);

export const updateAddress = (id, data) => authPut(`/api/v1/addresses/${id}`, data);

export const deleteAddress = (id) => authDelete(`/api/v1/addresses/${id}`);

export const setDefaultAddress = (id) => authPost(`/api/v1/addresses/${id}/set-default`, {});

export const setBillingAddress = (id) => authPost(`/api/v1/addresses/${id}/set-billing`, {});

export const getDefaultAddress = () => authGet('/api/v1/addresses/default/shipping');

export const getBillingAddress = () => authGet('/api/v1/addresses/default/billing');

// ──────────────────────────────────────────────────────────────────────────────
// PAYMENT METHODS API
// ──────────────────────────────────────────────────────────────────────────────

export const listPaymentMethods = async (skip = 0, limit = 50) => {
  return authGet(`/api/v1/payments/methods?skip=${skip}&limit=${limit}`);
};

export const getPaymentMethod = (id) => authGet(`/api/v1/payments/methods/${id}`);

export const createPaymentMethod = (data) => authPost('/api/v1/payments/methods', data);

export const deletePaymentMethod = (id) => authDelete(`/api/v1/payments/methods/${id}`);

export const setDefaultPaymentMethod = (id) => authPost(`/api/v1/payments/methods/${id}/set-default`, {});

export const getDefaultPaymentMethod = () => authGet('/api/v1/payments/methods/default/active');

export const validatePaymentMethod = (id) => authPost(`/api/v1/payments/methods/${id}/validate`, {});

// ──────────────────────────────────────────────────────────────────────────────
// USER PROFILE API
// ──────────────────────────────────────────────────────────────────────────────

export const getProfile = () => authGet('/api/v1/profile');

export const updateProfile = (data) => authPut('/api/v1/profile', data);

export const uploadAvatar = (formData) => {
  return authPost('/api/v1/profile/avatar', formData, {
    'Content-Type': 'multipart/form-data',
  });
};

export const deleteAvatar = () => authDelete('/api/v1/profile/avatar');

export const getPublicProfile = (userId) => client.get(`/api/v1/profile/public/${userId}`);

export const verifyPhone = () => authPost('/api/v1/profile/verify-phone', {});

export const verifyEmail = () => authPost('/api/v1/profile/verify-email', {});

// ──────────────────────────────────────────────────────────────────────────────
// RAZORPAY INTEGRATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Tokenize a card with Razorpay
 * This should be called from checkout or payment methods screen
 * 
 * @param {string} razorpayKeyId - Razorpay Key ID from backend config
 * @returns {Promise<object>} - Card token and details
 */
export const tokenizeCardWithRazorpay = async (razorpayKeyId) => {
  return new Promise((resolve, reject) => {
    const options = {
      key: razorpayKeyId, // Razorpay Key ID (get from /api/v1/features endpoint)
      recurring: '1', // For card tokenization
      description: 'Save Card for Future Payments',
      currency: 'INR',
      prefill: {
        // Will be filled by user in Razorpay form
      },
      handler: function (response) {
        // Razorpay returns token_ided in response
        resolve({
          card_token: response.razorpay_token || response.razorpay_payment_id,
          method: 'card',
        });
      },
      modalOptions: {
        hideTopBar: false,
      },
      onFailure: function (error) {
        reject(new Error(error.description || 'Card tokenization failed'));
      },
      onDismiss: function () {
        reject(new Error('Card tokenization cancelled'));
      },
    };

    // For React Native, use RazorpayCheckout
    try {
      const RazorpayCheckout = require('react-native-razorpay').default;
      RazorpayCheckout.open(options)
        .then(data => {
          // Handle success
          resolve({
            card_token: data.razorpay_token,
            card_last4: data.razorpay_payment_id?.slice(-4),
            method: 'card',
          });
        })
        .catch(error => {
          reject(error);
        });
    } catch (e) {
      reject(new Error('Razorpay not available'));
    }
  });
};

/**
 * Get Razorpay Key ID from backend
 * This should be called on app startup to get the public key
 * 
 * @returns {Promise<string>} - Razorpay Key ID
 */
export const getRazorpayKey = async () => {
  try {
    const response = await client.get('/api/v1/features');
    return response.data?.razorpay_key_id || '';
  } catch (error) {
    console.error('Failed to get Razorpay key:', error);
    return '';
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// CHECKOUT INTEGRATION
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get quick checkout info (default address + payment)
 * Used to pre-fill checkout screen
 */
export const getCheckoutQuickInfo = async () => {
  try {
    const [defaultAddr, defaultPayment] = await Promise.all([
      getDefaultAddress().catch(() => null),
      getDefaultPaymentMethod().catch(() => null),
    ]);

    return {
      address: defaultAddr?.data,
      payment: defaultPayment?.data,
    };
  } catch (error) {
    console.error('Failed to get checkout info:', error);
    return { address: null, payment: null };
  }
};

/**
 * Apply saved address to order
 * Called during checkout
 */
export const applyAddressToOrder = async (orderId, addressId) => {
  return authPut(`/api/v1/orders/${orderId}`, {
    address_id: addressId,
  });
};

/**
 * Apply saved payment to order
 * Called during payment
 */
export const applyPaymentMethodToOrder = async (orderId, paymentMethodId) => {
  return authPost(`/api/v1/orders/${orderId}/apply-payment`, {
    payment_method_id: paymentMethodId,
  });
};
