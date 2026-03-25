import client from './api';

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

export const updateProfile = (data) => client.patch('/auth/profile', data);
export const getMe = () => client.get('/auth/me');
export const switchRole = (role) => client.post('/auth/switch-role', { role });
export const refreshToken = (token) => client.post('/auth/refresh', { refresh_token: token });
export const deleteAccount = (deleteCustomer, deleteBusiness) =>
  client.delete('/auth/delete-account', { data: { delete_customer: deleteCustomer, delete_business: deleteBusiness } });

export const uploadFile = async (uri, folder = 'general') => {
  const formData = new FormData();
  const filename = uri.split('/').pop();
  const ext = filename.split('.').pop();
  formData.append('file', {
    uri,
    name: filename,
    type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
  });
  formData.append('folder', folder);
  return client.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
