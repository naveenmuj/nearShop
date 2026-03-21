import api from './client'
export const sendOTP = (phone) => api.post('/auth/send-otp', { phone })
export const verifyOTP = (phone, code) => api.post('/auth/verify-otp', { phone, code })
export const completeProfile = (data) => api.post('/auth/complete-profile', data)
export const switchRole = (role) => api.post('/auth/switch-role', { role })
export const getMe = () => api.get('/auth/me')
