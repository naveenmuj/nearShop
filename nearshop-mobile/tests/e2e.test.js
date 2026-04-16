/**
 * E2E Integration Tests - Phase 1 Features
 * Tests all APIs and mobile flows for:
 * - Saved Addresses
 * - Saved Payment Methods
 * - User Profiles
 * - Checkout Integration
 * 
 * Run with: npm test -- e2e.test.js
 */

import axios from 'axios';

// ──────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ──────────────────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000/api/v1';
const TEST_TIMEOUT = 10000;

// Mock user credentials
const testUser = {
  phone: '+919876543210',
  password: 'TestPassword@123',
  name: 'Test User',
};

let authToken = null;
let userId = null;

// Helper to make authenticated requests
const authRequest = async (method, endpoint, data = null, headers = {}) => {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    timeout: TEST_TIMEOUT,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (data) config.data = data;

  const response = await axios(config);
  return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION SETUP
// ──────────────────────────────────────────────────────────────────────────────

describe('Phase 1 E2E Integration Tests', () => {
  beforeAll(async () => {
    console.log('🔐 Setting up authentication...');
    
    try {
      // In real tests, you'd create or login an existing user
      // For now, use env variables for test credentials
      authToken = process.env.TEST_AUTH_TOKEN || 'mock-jwt-token';
      userId = process.env.TEST_USER_ID || 'mock-user-id';
      
      if (!authToken || authToken === 'mock-jwt-token') {
        console.warn('⚠️  Using mock token. Set TEST_AUTH_TOKEN and TEST_USER_ID env vars for real tests');
      }
    } catch (err) {
      console.error('❌ Authentication failed:', err.message);
      throw err;
    }
  }, TEST_TIMEOUT);

  // ────────────────────────────────────────────────────────────────────────────
  // ADDRESSES API TESTS
  // ────────────────────────────────────────────────────────────────────────────

  describe('Addresses API', () => {
    let addressId = null;
    let secondAddressId = null;

    test('POST /addresses - Create first address (auto-default)', async () => {
      const addressData = {
        street: '123 Main Street',
        city: 'New Delhi',
        state: 'Delhi',
        postal_code: '110001',
        phone: '+919876543210',
        label: 'home',
        lat: 28.7041,
        lng: 77.1025,
      };

      const response = await authRequest('POST', '/addresses', addressData);
      
      expect(response).toHaveProperty('id');
      expect(response.street).toBe(addressData.street);
      expect(response.is_default).toBe(true); // First address should be default
      expect(response.created_at).toBeDefined();
      
      addressId = response.id;
    }, TEST_TIMEOUT);

    test('GET /addresses - List addresses with pagination', async () => {
      const response = await authRequest('GET', '/addresses?skip=0&limit=10');
      
      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(0);
      expect(response[0]).toHaveProperty('id');
      expect(response[0]).toHaveProperty('is_default');
      expect(response[0]).toHaveProperty('deleted_at');
    }, TEST_TIMEOUT);

    test('GET /addresses/{id} - Get single address', async () => {
      const response = await authRequest('GET', `/addresses/${addressId}`);
      
      expect(response.id).toBe(addressId);
      expect(response.street).toBeDefined();
      expect(response.city).toBeDefined();
    }, TEST_TIMEOUT);

    test('PUT /addresses/{id} - Update address', async () => {
      const updateData = {
        city: 'Bangalore',
        state: 'Karnataka',
      };

      const response = await authRequest('PUT', `/addresses/${addressId}`, updateData);
      
      expect(response.city).toBe('Bangalore');
      expect(response.state).toBe('Karnataka');
      expect(response.street).toBe('123 Main Street'); // Unchanged
    }, TEST_TIMEOUT);

    test('POST /addresses - Create second address', async () => {
      const addressData = {
        street: '456 Work Avenue',
        city: 'Bangalore',
        state: 'Karnataka',
        postal_code: '560001',
        phone: '+919876543210',
        label: 'work',
        lat: 12.9716,
        lng: 77.5946,
      };

      const response = await authRequest('POST', '/addresses', addressData);
      
      expect(response.is_default).toBe(false); // Second address should not be default
      secondAddressId = response.id;
    }, TEST_TIMEOUT);

    test('POST /addresses/{id}/set-default - Change default address', async () => {
      const response = await authRequest('POST', `/addresses/${secondAddressId}/set-default`, {});
      
      expect(response.is_default).toBe(true);
      
      // Verify first address is no longer default
      const firstAddr = await authRequest('GET', `/addresses/${addressId}`);
      expect(firstAddr.is_default).toBe(false);
    }, TEST_TIMEOUT);

    test('POST /addresses/{id}/set-billing - Set billing address', async () => {
      const response = await authRequest('POST', `/addresses/${addressId}/set-billing`, {});
      
      expect(response.is_billing).toBe(true);
    }, TEST_TIMEOUT);

    test('GET /addresses/default/shipping - Get default shipping address', async () => {
      const response = await authRequest('GET', '/addresses/default/shipping');
      
      expect(response).toHaveProperty('id');
      expect(response.is_default).toBe(true);
      expect(response.is_billing).toBe(false);
    }, TEST_TIMEOUT);

    test('GET /addresses/default/billing - Get default billing address', async () => {
      const response = await authRequest('GET', '/addresses/default/billing');
      
      expect(response).toHaveProperty('id');
      expect(response.is_billing).toBe(true);
    }, TEST_TIMEOUT);

    test('DELETE /addresses/{id} - Soft delete address', async () => {
      // Create a third address to delete
      const addressData = {
        street: '789 Test Road',
        city: 'Pune',
        state: 'Maharashtra',
        postal_code: '411001',
        phone: '+919876543210',
        label: 'other',
      };

      const created = await authRequest('POST', '/addresses', addressData);
      const idToDelete = created.id;

      // Delete it
      await authRequest('DELETE', `/addresses/${idToDelete}`);

      // Verify it's marked as deleted but can be recovered
      // (This depends on backend implementation - usually soft delete)
      const list = await authRequest('GET', '/addresses');
      const stillExists = list.some(a => a.id === idToDelete && a.deleted_at === null);
      expect(stillExists).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // PAYMENT METHODS API TESTS
  // ────────────────────────────────────────────────────────────────────────────

  describe('Payment Methods API', () => {
    let cardId = null;
    let upiId = null;

    test('POST /payments/methods - Add card (with Razorpay token)', async () => {
      const cardData = {
        type: 'card',
        card_token: 'tok_1234567890abcdef',
        card_last4: '4111',
        card_brand: 'Visa',
        card_expiry_month: 12,
        card_expiry_year: 2026,
      };

      const response = await authRequest('POST', '/payments/methods', cardData);
      
      expect(response).toHaveProperty('id');
      expect(response.type).toBe('card');
      expect(response.card_last4).toBe('4111');
      expect(response.is_default).toBe(true); // First method auto-defaults
      expect(response.is_active).toBe(true);
      
      cardId = response.id;
    }, TEST_TIMEOUT);

    test('POST /payments/methods - Add UPI', async () => {
      const upiData = {
        type: 'upi',
        upi_id: 'user@okhdfcbank',
      };

      const response = await authRequest('POST', '/payments/methods', upiData);
      
      expect(response.type).toBe('upi');
      expect(response.upi_id).toBe('user@okhdfcbank');
      expect(response.is_default).toBe(false);
      
      upiId = response.id;
    }, TEST_TIMEOUT);

    test('POST /payments/methods - Add wallet', async () => {
      const walletData = {
        type: 'wallet',
        wallet_id: 'wallet_123456',
      };

      const response = await authRequest('POST', '/payments/methods', walletData);
      
      expect(response.type).toBe('wallet');
      expect(response.wallet_id).toBe('wallet_123456');
    }, TEST_TIMEOUT);

    test('GET /payments/methods - List payment methods', async () => {
      const response = await authRequest('GET', '/payments/methods?skip=0&limit=10');
      
      expect(response).toHaveProperty('methods');
      expect(response).toHaveProperty('total');
      expect(Array.isArray(response.methods)).toBe(true);
      expect(response.methods.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('GET /payments/methods/{id} - Get single payment method', async () => {
      const response = await authRequest('GET', `/payments/methods/${cardId}`);
      
      expect(response.id).toBe(cardId);
      expect(response.type).toBe('card');
    }, TEST_TIMEOUT);

    test('POST /payments/methods/{id}/set-default - Change default payment', async () => {
      const response = await authRequest('POST', `/payments/methods/${upiId}/set-default`, {});
      
      expect(response.is_default).toBe(true);
      
      // Verify card is no longer default
      const card = await authRequest('GET', `/payments/methods/${cardId}`);
      expect(card.is_default).toBe(false);
    }, TEST_TIMEOUT);

    test('GET /payments/methods/default/active - Get default payment method', async () => {
      const response = await authRequest('GET', '/payments/methods/default/active');
      
      expect(response).toHaveProperty('id');
      expect(response.is_default).toBe(true);
      expect(response.is_active).toBe(true);
    }, TEST_TIMEOUT);

    test('POST /payments/methods/{id}/validate - Validate payment method', async () => {
      const response = await authRequest('POST', `/payments/methods/${cardId}/validate`, {});
      
      expect(response).toHaveProperty('valid');
      expect(response.valid).toBe(true);
    }, TEST_TIMEOUT);

    test('DELETE /payments/methods/{id} - Delete payment method', async () => {
      const response = await authRequest('DELETE', `/payments/methods/${cardId}`);
      
      expect(response.success).toBe(true);
      
      // Verify it's deactivated
      const method = await authRequest('GET', `/payments/methods/${cardId}`);
      expect(method.is_active).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // USER PROFILE API TESTS
  // ────────────────────────────────────────────────────────────────────────────

  describe('User Profile API', () => {
    test('GET /profile - Get current user profile', async () => {
      const response = await authRequest('GET', '/profile');
      
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('user_id');
      expect(response).toHaveProperty('display_name');
      expect(response).toHaveProperty('total_orders');
      expect(response).toHaveProperty('avg_rating');
    }, TEST_TIMEOUT);

    test('PUT /profile - Update profile', async () => {
      const updateData = {
        display_name: 'John Doe Updated',
        bio: 'Coffee enthusiast and tech lover',
        preferred_language: 'en',
        timezone: 'Asia/Kolkata',
      };

      const response = await authRequest('PUT', '/profile', updateData);
      
      expect(response.display_name).toBe('John Doe Updated');
      expect(response.bio).toBe('Coffee enthusiast and tech lover');
    }, TEST_TIMEOUT);

    test('POST /profile/verify-phone - Mark phone as verified', async () => {
      const response = await authRequest('POST', '/profile/verify-phone', {});
      
      expect(response).toHaveProperty('phone_verified_at');
      expect(response.phone_verified_at).not.toBeNull();
    }, TEST_TIMEOUT);

    test('POST /profile/verify-email - Mark email as verified', async () => {
      const response = await authRequest('POST', '/profile/verify-email', {});
      
      expect(response).toHaveProperty('email_verified_at');
      expect(response.email_verified_at).not.toBeNull();
    }, TEST_TIMEOUT);

    test('GET /profile/public/{userId} - Get public profile', async () => {
      const response = await authRequest('GET', `/profile/public/${userId}`);
      
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('display_name');
      expect(response).toHaveProperty('total_orders');
      expect(response).toHaveProperty('badges');
      // Should NOT include private fields
      expect(response.timezone).toBeUndefined();
      expect(response.preferred_language).toBeUndefined();
    }, TEST_TIMEOUT);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // INTEGRATION TESTS - Checkout Flow
  // ────────────────────────────────────────────────────────────────────────────

  describe('Checkout Integration Flow', () => {
    let checkoutAddressId = null;
    let checkoutPaymentId = null;

    test('Scenario: Add address → Add payment → Use in checkout', async () => {
      // Step 1: Add address
      const addressData = {
        street: '999 Checkout Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400001',
        phone: '+919876543210',
        label: 'checkout_test',
      };

      const createdAddress = await authRequest('POST', '/addresses', addressData);
      checkoutAddressId = createdAddress.id;
      expect(createdAddress).toHaveProperty('id');

      // Step 2: Add payment method
      const paymentData = {
        type: 'upi',
        upi_id: 'checkout@okhdfcbank',
      };

      const createdPayment = await authRequest('POST', '/payments/methods', paymentData);
      checkoutPaymentId = createdPayment.id;
      expect(createdPayment).toHaveProperty('id');

      // Step 3: Set both as default
      await authRequest('POST', `/addresses/${checkoutAddressId}/set-default`, {});
      await authRequest('POST', `/payments/methods/${checkoutPaymentId}/set-default`, {});

      // Step 4: Verify they're the defaults
      const defaultAddr = await authRequest('GET', '/addresses/default/shipping');
      expect(defaultAddr.id).toBe(checkoutAddressId);

      const defaultPayment = await authRequest('GET', '/payments/methods/default/active');
      expect(defaultPayment.id).toBe(checkoutPaymentId);

      console.log('✅ Checkout integration scenario passed');
    }, TEST_TIMEOUT);

    test('Scenario: User has multiple addresses, switches between them', async () => {
      // Create 3 addresses
      const addresses = [];
      for (let i = 0; i < 3; i++) {
        const addr = await authRequest('POST', '/addresses', {
          street: `Street ${i + 1}`,
          city: 'Test City',
          state: 'Test State',
          postal_code: '123456',
          phone: '+919876543210',
          label: `label_${i}`,
        });
        addresses.push(addr);
      }

      // Switch between them as default
      for (let i = 0; i < addresses.length; i++) {
        await authRequest('POST', `/addresses/${addresses[i].id}/set-default`, {});
        const defaultAddr = await authRequest('GET', '/addresses/default/shipping');
        expect(defaultAddr.id).toBe(addresses[i].id);
      }

      console.log('✅ Address switching scenario passed');
    }, TEST_TIMEOUT);

    test('Scenario: User deletes all payment methods, adds new one', async () => {
      // Get all methods
      let methods = await authRequest('GET', '/payments/methods');
      const methodIds = methods.methods.map(m => m.id);

      // Delete all
      for (const id of methodIds) {
        await authRequest('DELETE', `/payments/methods/${id}`);
      }

      // Verify all are deactivated
      methods = await authRequest('GET', '/payments/methods?active_only=true');
      expect(methods.methods.length).toBe(0);

      // Add new method
      const newMethod = await authRequest('POST', '/payments/methods', {
        type: 'card',
        card_token: 'tok_new_123',
        card_last4: '5555',
        card_brand: 'Mastercard',
        card_expiry_month: 6,
        card_expiry_year: 2027,
      });

      expect(newMethod.is_default).toBe(true); // Becomes default when re-adding

      console.log('✅ Payment method reset scenario passed');
    }, TEST_TIMEOUT);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING TESTS
  // ────────────────────────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    test('GET /addresses/{invalid-id} - Returns 404', async () => {
      try {
        await authRequest('GET', '/addresses/invalid-id-12345');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.response?.status).toBe(404);
      }
    }, TEST_TIMEOUT);

    test('POST /addresses - Missing required fields returns 400', async () => {
      try {
        await authRequest('POST', '/addresses', {
          street: 'Only street', // Missing city, state, postal_code, phone
        });
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.response?.status).toBe(400);
      }
    }, TEST_TIMEOUT);

    test('POST /payments/methods - Invalid UPI format', async () => {
      try {
        await authRequest('POST', '/payments/methods', {
          type: 'upi',
          upi_id: 'invalid-upi-format', // Missing @
        });
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.response?.status).toBe(400);
      }
    }, TEST_TIMEOUT);

    test('DELETE /addresses/{id} - Non-existent address', async () => {
      try {
        await authRequest('DELETE', '/addresses/nonexistent');
        fail('Should have thrown an error');
      } catch (err) {
        expect(err.response?.status).toBe(404);
      }
    }, TEST_TIMEOUT);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PERFORMANCE TESTS
// ──────────────────────────────────────────────────────────────────────────────

describe('Performance Tests', () => {
  test('Listing 50 addresses completes within 1 second', async () => {
    const start = Date.now();
    await authRequest('GET', '/addresses?skip=0&limit=50');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
    console.log(`✅ List addresses: ${duration}ms`);
  }, TEST_TIMEOUT);

  test('Creating address completes within 500ms', async () => {
    const start = Date.now();
    const addressData = {
      street: 'Perf Test Street',
      city: 'Perf Test City',
      state: 'Perf Test State',
      postal_code: '999999',
      phone: '+919876543210',
      label: 'perf_test',
    };

    await authRequest('POST', '/addresses', addressData);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500);
    console.log(`✅ Create address: ${duration}ms`);
  }, TEST_TIMEOUT);

  test('Setting default address completes within 300ms', async () => {
    // Get first address
    const addresses = await authRequest('GET', '/addresses');
    if (addresses.length === 0) {
      console.log('⏭️  Skipping - no addresses');
      return;
    }

    const start = Date.now();
    await authRequest('POST', `/addresses/${addresses[0].id}/set-default`, {});
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(300);
    console.log(`✅ Set default: ${duration}ms`);
  }, TEST_TIMEOUT);
});
