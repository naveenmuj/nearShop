import client, { authDelete, authGet, authPatch, authPost, authPut } from './api';

export const sendOtp = (phone) => client.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, code) => client.post('/auth/verify-otp', { phone, code });

// Complete profile with fallback endpoints
export const completeProfile = async (data) => {
  try {
    // Try primary endpoint
    return await client.post('/auth/complete-profile', data);
  } catch (err) {
    // If 404, try alternative endpoint names
    if (err.response?.status === 404) {
      console.warn('Primary endpoint /auth/complete-profile failed, trying alternatives...');
      try {
        // Try alternative: /auth/profile
        return await client.post('/auth/profile', data);
      } catch (err2) {
        // Try alternative: /users/complete-profile
        try {
          return await client.post('/users/complete-profile', data);
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
export const switchRole = async (role) => {
  const response = await authPost('/auth/switch-role', { role });
  // Return full response so caller can extract tokens if provided
  return response;
};
export const refreshToken = (token) => client.post('/auth/refresh', { refresh_token: token });
export const deleteAccount = (deleteCustomer, deleteBusiness) =>
  authDelete('/auth/delete-account', { data: { delete_customer: deleteCustomer, delete_business: deleteBusiness } });

export const uploadFile = async (uri, options = 'general') => {
  const uploadOptions = typeof options === 'string' ? { folder: options } : (options || {});
  const formData = new FormData();
  const filename = uri.split('/').pop();
  const ext = filename.split('.').pop();
  formData.append('file', {
    uri,
    name: filename,
    type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
  });
  formData.append('folder', uploadOptions.folder || 'general');
  if (uploadOptions.entityType) formData.append('entity_type', uploadOptions.entityType);
  if (uploadOptions.entityId) formData.append('entity_id', uploadOptions.entityId);
  if (uploadOptions.purpose) formData.append('purpose', uploadOptions.purpose);
  if (uploadOptions.shopId) formData.append('shop_id', uploadOptions.shopId);
  if (uploadOptions.productId) formData.append('product_id', uploadOptions.productId);
  if (uploadOptions.documentType) formData.append('document_type', uploadOptions.documentType);
  return client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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
