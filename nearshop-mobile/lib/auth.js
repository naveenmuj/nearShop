import client from './api';

export const sendOtp = (phone) => client.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, code) => client.post('/auth/verify-otp', { phone, code });
export const completeProfile = (data) => client.post('/auth/complete-profile', data);
export const updateProfile = (data) => client.patch('/auth/profile', data);
export const getMe = () => client.get('/auth/me');
export const switchRole = (role) => client.post('/auth/switch-role', { role });
export const refreshToken = (token) => client.post('/auth/refresh', { refresh_token: token });
