import client, { authDelete, authGet, authPatch, authPost, authPut } from './api';
import AuthService from './authService';

export const sendOtp = (phone) => client.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, code) => client.post('/auth/verify-otp', { phone, code });

/**
 * Complete profile with fallback endpoints - requires auth
 * 
 * After completing profile, the backend returns new tokens with the updated role.
 * This is critical for business users - without new tokens, subsequent calls
 * to business-only endpoints (like createShop) would fail.
 * 
 * @param {Object} data - Profile data (name, role, interests)
 * @returns {Promise<Object>} - The API response
 */
export const completeProfile = async (data) => {
  try {
    // Try primary endpoint with authentication
    const response = await authPost('/auth/complete-profile', data);
    
    // Save new tokens if backend provides them (critical for role changes)
    if (response?.data?.access_token) {
      await AuthService.saveTokens({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
      });
      if (__DEV__) {
        console.log('[Auth] New tokens saved after profile completion with role:', data.role);
      }
    }
    
    return response;
  } catch (err) {
    // If 404, try alternative endpoint names
    if (err.response?.status === 404) {
      console.warn('Primary endpoint /auth/complete-profile failed, trying alternatives...');
      try {
        // Try alternative: /auth/profile
        return await authPatch('/auth/profile', data);
      } catch (err2) {
        // Try alternative: /users/complete-profile
        try {
          return await authPost('/users/complete-profile', data);
        } catch (err3) {
          // All failed, return original error
          throw err;
        }
      }
    }
    throw err;
  }
};

export const updateProfile = (data) => authPatch('/auth/profile', data);
export const getMe = () => authGet('/auth/me');
export const updateUserSettings = (data) => authPatch('/auth/settings', data);
export const updateLocationProfile = (data) => authPatch('/auth/profile', data);
export const getLocationProfile = () => authGet('/auth/me');

/**
 * Switch user role - uses centralized auth service for proper token management
 * 
 * @param {string} role - The role to switch to ('customer' or 'business')
 * @returns {Promise<Object>} - The API response with user and tokens
 */
export const switchRole = async (role) => {
  const response = await authPost('/auth/switch-role', { role });
  
  // Save tokens if backend provides new ones
  if (response?.data?.access_token) {
    await AuthService.saveTokens({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
    });
  }
  
  // Return full response so caller can use user data
  return response;
};

export const refreshToken = (token) => client.post('/auth/refresh', { refresh_token: token });
export const deleteAccount = (deleteCustomer, deleteBusiness) =>
  authDelete('/auth/delete-account', { data: { delete_customer: deleteCustomer, delete_business: deleteBusiness } });

function _guessMimeType(filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

export const uploadFile = async (uri, options = 'general') => {
  const uploadOptions = typeof options === 'string' ? { folder: options } : (options || {});
  const formData = new FormData();
  const filename = uploadOptions.fileName || uri.split('/').pop();
  const mimeType = uploadOptions.mimeType || _guessMimeType(filename);
  formData.append('file', {
    uri,
    name: filename,
    type: mimeType,
  });
  formData.append('folder', uploadOptions.folder || 'general');
  if (uploadOptions.entityType) formData.append('entity_type', uploadOptions.entityType);
  if (uploadOptions.entityId) formData.append('entity_id', uploadOptions.entityId);
  if (uploadOptions.purpose) formData.append('purpose', uploadOptions.purpose);
  if (uploadOptions.shopId) formData.append('shop_id', uploadOptions.shopId);
  if (uploadOptions.productId) formData.append('product_id', uploadOptions.productId);
  if (uploadOptions.documentType) formData.append('document_type', uploadOptions.documentType);
  
  // Use authPost for proper token handling with multipart data
  const token = await AuthService.getAccessToken();
  const headers = { 'Content-Type': 'multipart/form-data' };
  if (token) headers.Authorization = `Bearer ${token}`;
  
  return client.post('/upload', formData, { headers });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createAddress = (data) => authPost('/auth/addresses', data);
export const listAddresses = () => authGet('/auth/addresses');
export const getAddress = (addressId) => authGet(`/auth/addresses/${addressId}`);
export const updateAddress = (addressId, data) => authPut(`/auth/addresses/${addressId}`, data);
export const deleteAddress = (addressId) => authDelete(`/auth/addresses/${addressId}`);
export const setDefaultAddress = (addressId) => authPost(`/auth/addresses/${addressId}/set-default`);
