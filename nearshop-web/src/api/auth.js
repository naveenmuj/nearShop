import api from './client'
export const sendOTP = (phone) => api.post('/auth/send-otp', { phone })
export const verifyOTP = (phone, code) => api.post('/auth/verify-otp', { phone, code })
export const completeProfile = (data) => api.post('/auth/complete-profile', data)
export const updateProfile = (data) => api.patch('/auth/profile', data)
export const switchRole = (role) => api.post('/auth/switch-role', { role })
export const getMe = () => api.get('/auth/me')

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS APIs
// ═══════════════════════════════════════════════════════════════════════════════

export const createAddress = (data) => api.post('/auth/addresses', data)
export const listAddresses = () => api.get('/auth/addresses')
export const getAddress = (addressId) => api.get(`/auth/addresses/${addressId}`)
export const updateAddress = (addressId, data) => api.put(`/auth/addresses/${addressId}`, data)
export const deleteAddress = (addressId) => api.delete(`/auth/addresses/${addressId}`)
export const setDefaultAddress = (addressId) => api.post(`/auth/addresses/${addressId}/set-default`)
